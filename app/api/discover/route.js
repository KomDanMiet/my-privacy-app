// app/api/discover/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import vendors from "./data/vendors.json"; // fallback/demo only
import { createClient } from "@supabase/supabase-js";

/* ---------- helpers ---------- */
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s) => (s || "").trim();
const normEmail = (s) => (s || "").toLowerCase().trim();

async function topDomainsFor(email, take = 50) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // New snapshot table shape: one row per (email, domain) with "count"
  const { data, error } = await sb
    .from("discovered_senders")
    .select("domain,count")
    .eq("email", email)
    .order("count", { ascending: false })
    .limit(take);
  if (error) throw error;
  return (data || []).map((r) => r.domain);
}

async function lookupContact(domain, force = false, origin) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || origin;
  const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${force ? "&force=1" : ""}`;

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const j = await res.json().catch(() => ({}));
    return {
      domain,
      ok: !!j?.ok,
      contact_type: j?.contact?.contact_type || "none",
      value: j?.contact?.value || null,
      confidence: j?.contact?.confidence ?? 0,
    };
  } catch {
    return { domain, ok: false, contact_type: "none", value: null, confidence: 0 };
  } finally {
    clearTimeout(to);
  }
}

async function hibpLookup(email) {
  const key = process.env.HIBP_API_KEY;
  if (!key) return [];
  try {
    const resp = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(
        email
      )}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": key,
          "user-agent": "my-privacy-app/1.0 (contact@example.com)",
        },
      }
    );
    if (resp.status === 404) return [];
    if (!resp.ok) return [];
    const breaches = await resp.json();
    return (breaches || []).map((b) => ({
      name: b.Name,
      domain: (b.Domain || b.Name || "").toLowerCase(),
      category: "Breach Evidence",
      privacyUrl: b.Domain ? `https://${b.Domain}` : undefined,
      source: "hibp",
      evidence: { breachDate: b.BreachDate, dataClasses: b.DataClasses },
    }));
  } catch {
    return [];
  }
}
/* -------------------------------- */

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body.email || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));
    const confMin = Number(body.confidenceMin ?? process.env.DSAR_MIN_CONF ?? 60);
    const force = !!body.force;

    // Fallback: geen email -> oude curated lijst (demo)
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      const likely = vendors.map((v) => ({ ...v, source: "catalog" }));
      return NextResponse.json({
        ok: true,
        email: null,
        considered: likely.length,
        eligible: [],
        needsForm: [],
        review: [],
        none: likely, // toon als "generiek / niet gepersonaliseerd"
      });
    }

    const origin = new URL(req.url).origin;
    const domains = await topDomainsFor(email, limit);

    // 2) contact lookup per domein
    const results = [];
    // licht parallel, niet te agressief
    const CONCURRENCY = 5;
    let i = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }).map(async () => {
        while (i < domains.length) {
          const idx = i++;
          const d = domains[idx];
          results[idx] = await lookupContact(d, force, origin);
        }
      })
    );

    // 3) buckets
    const eligible = results.filter(
      (c) => c.ok && c.contact_type === "email" && (c.confidence ?? 0) >= confMin
    );
    const needsForm = results.filter((c) => c.ok && c.contact_type === "form");
    const review = results.filter(
      (c) => c.ok && c.contact_type === "email" && (c.confidence ?? 0) < confMin
    );
    const none = results.filter((c) => !c.ok || c.contact_type === "none");

    // 4) optionele HIBP-rijen bijvoegen onder "none" (zonder duplicaten)
    const hibp = await hibpLookup(email);
    const noneDomains = new Set(none.map((x) => x.domain));
    for (const h of hibp) {
      if (!noneDomains.has(h.domain)) {
        none.push({
          domain: h.domain,
          ok: true,
          contact_type: "none",
          value: h.privacyUrl || null,
          confidence: 0,
          source: "hibp",
          evidence: h.evidence,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      email,
      considered: domains.length,
      eligible,
      needsForm,
      review,
      none,
    });
  } catch (e) {
    console.error("discover error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST { email } to get personalized discovery buckets",
  });
}
