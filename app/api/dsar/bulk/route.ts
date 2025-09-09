// app/api/dsar/bulk/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BASE_URL } from "@/lib/google";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Enriched = {
  domain: string;
  ok: boolean;
  contact_type: "email" | "form" | "none";
  value: string | null;
  confidence: number;
};

const norm = (s: string) => (s || "").trim();
const normEmail = (s: string) => (s || "").toLowerCase().trim();

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

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

async function lookupContacts(domains: string[], force = false): Promise<Enriched[]> {
  const base = BASE_URL;
  return mapLimit(domains, 4, async (domain) => {
    const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${
      force ? "&force=1" : ""
    }`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const j: any = await res.json();
      return {
        domain,
        ok: !!j?.ok,
        contact_type: j?.contact?.contact_type || "none",
        value: j?.contact?.value || null,
        confidence: j?.contact?.confidence ?? 0,
      };
    } catch {
      return { domain, ok: false, contact_type: "none", value: null, confidence: 0 };
    }
  });
}

async function sendOne(domain: string, subject: string, html?: string, text?: string, replyTo?: string) {
  const base = BASE_URL;
  const r = await fetch(`${base}/api/dsar/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ domain, subject, html, text, replyTo }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body.email || "");
    const subject = norm(body.subject || "Data Subject Access Request (GDPR)");
    const html = body.html ? String(body.html) : undefined;
    const text = body.text ? String(body.text) : undefined;
    const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));
    const force = !!body.force;
    const confMin = Number(body.confidenceMin ?? process.env.DSAR_MIN_CONF ?? 60);

    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    if (!html && !text) {
      return NextResponse.json({ ok: false, error: "Missing html or text body" }, { status: 400 });
    }

    const domains = await topDomainsFor(email, limit);
    const contacts = await lookupContacts(domains, force);

    const targets = contacts.filter(
      (c) => c.ok && c.contact_type === "email" && (c.confidence ?? 0) >= confMin
    );

    const results = await mapLimit(targets, 3, async (c) => {
      const resp = await sendOne(c.domain, subject, html, text, email);
      return { domain: c.domain, contact_confidence: c.confidence, resp };
    });

    const sentOk = results.filter((r) => r.resp?.body?.ok).length;

    return NextResponse.json({
      ok: true,
      email,
      considered: domains.length,
      eligible: targets.length,
      sent_ok: sentOk,
      results,
      skipped: contacts
        .filter((c) => !(c.ok && c.contact_type === "email" && (c.confidence ?? 0) >= confMin))
        .map((c) => ({ domain: c.domain, type: c.contact_type, confidence: c.confidence })),
    });
  } catch (e: any) {
    console.error("[dsar/bulk] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Health/debug: zonder ?email=... een korte bevestiging
  try {
    const url = new URL(req.url);
    const email = normEmail(url.searchParams.get("email") || "");
    if (!email) {
      return NextResponse.json({ ok: true, info: "dsar/bulk ready (POST to use)" });
    }
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 10)));
    const force = url.searchParams.get("force") === "1";
    const domains = await topDomainsFor(email, limit);
    const contacts = await lookupContacts(domains, force);
    return NextResponse.json({ ok: true, sample: contacts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}