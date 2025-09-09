// app/api/dsar/preview/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const norm = (s: string) => (s || "").trim();
const normEmail = (s: string) => (s || "").toLowerCase().trim();

async function topDomainsFor(email: string, take = 50): Promise<string[]> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from("discovered_senders")
    .select("domain")
    .eq("email", email)
    .limit(2000);
  if (error) throw error;

  const counts = new Map<string, number>();
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

async function lookupContacts(domains: string[], force = false) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
  const out: any[] = [];
  for (const domain of domains) {
    const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${force ? "&force=1" : ""}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const j: any = await res.json();
      out.push({
        domain,
        ok: !!j?.ok,
        contact_type: j?.contact?.contact_type || "none",
        value: j?.contact?.value || null,
        confidence: j?.contact?.confidence ?? 0,
      });
    } catch {
      out.push({ domain, ok: false, contact_type: "none", value: null, confidence: 0 });
    }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body.email || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));
    const confMin = Number(body.confidenceMin ?? process.env.DSAR_MIN_CONF ?? 60);
    const force = !!body.force;

    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const domains = await topDomainsFor(email, limit);
    const contacts = await lookupContacts(domains, force);

    const eligible = contacts.filter(c => c.ok && c.contact_type === "email" && (c.confidence ?? 0) >= confMin);
    const needsForm = contacts.filter(c => c.ok && c.contact_type === "form");
    const review    = contacts.filter(c => c.ok && c.contact_type === "email" && (c.confidence ?? 0) < confMin);
    const none      = contacts.filter(c => !c.ok || c.contact_type === "none");

    return NextResponse.json({ ok: true, email, considered: domains.length, eligible, needsForm, review, none });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "POST { email } to get preview buckets" });
}
