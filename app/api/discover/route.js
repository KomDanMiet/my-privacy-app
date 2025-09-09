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
  const { data, error } = await sb
    .from("discovered_senders")
    .select("domain")
    .eq("email", email)
    .limit(2000);
  if (error) throw error;

  const counts = new Map();
  for (const row of data || []) {
    const d = (row.domain || "").toLowerCase();
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([domain]) => domain);
}

async function lookupContact(domain, force = false) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
  const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${
    force ? "&force=1" : ""
  }`;
  const res = await fetch(url, { cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  return {
    domain,
    ok: !!j?.ok,
    contact_type: j?.contact?.contact_type || "none",
    value: j?.contact?.value || null,
    confidence: j?.contact?.confidence ?? 0,
  };
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

    // 1) echte domeinen uit je inbox-index
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
          results[idx] = await lookupContact(d, force);
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
