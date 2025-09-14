// app/api/discovery/contacts/enrich/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BASE_URL } from "@/lib/google";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** simpele limiter, zodat we de site niet DDoS'en */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const ret: R[] = [];
  let i = 0;
  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return ret;
}

function normEmail(e: string) {
  return (e || "").toLowerCase().trim();
}

async function distinctDomainsForEmail(email: string, maxRows = 2000) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // haal "platte" lijst en dedup in code (makkelijkst)
  const { data, error } = await sb
    .from("discovered_senders")
    .select("domain")
    .eq("email", email)
    .limit(maxRows);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data || []) {
    const d = (row.domain || "").toLowerCase();
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  // sort op frequentie
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, count }));
}

async function enrichDomains(domains: string[], force: boolean) {
  // gebruik je eigen public endpoint (force=1 voor recrawl)
  const base = BASE_URL;
  return await mapLimit(domains, 4, async (domain) => {
    const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${
      force ? "&force=1" : ""
    }`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as any;
      return {
        domain,
        ok: !!json?.ok,
        contact_type: json?.contact?.contact_type || "none",
        value: json?.contact?.value || null,
        confidence: json?.contact?.confidence ?? 0,
      };
    } catch (e: any) {
      return { domain, ok: false, contact_type: "none", value: null, confidence: 0, error: e?.message };
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body.email || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));
    const force = !!body.force;

    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    const ranked = await distinctDomainsForEmail(email, 2000);
    const top = ranked.slice(0, limit).map((r) => r.domain);

    const results = await enrichDomains(top, force);

    const summary = results.reduce(
      (acc, r) => {
        const t = r.contact_type || "none";
        acc.byType[t] = (acc.byType[t] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, byType: {} as Record<string, number> }
    );

    return NextResponse.json({
      ok: true,
      email,
      checked: results.length,
      summary,
      results,
    });
  } catch (e: any) {
    console.error("[contacts/enrich] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // kleine debug: /api/discovery/contacts/enrich?email=...&limit=&force=1
  const url = new URL(req.url);
  const email = normEmail(url.searchParams.get("email") || "");
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
  const force = url.searchParams.get("force") === "1";
  if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
  const ranked = await distinctDomainsForEmail(email, 2000);
  const top = ranked.slice(0, limit).map((r) => r.domain);
  const results = await enrichDomains(top, force);
  const summary = results.reduce(
    (acc, r) => {
      const t = r.contact_type || "none";
      acc.byType[t] = (acc.byType[t] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, byType: {} as Record<string, number> }
  );
  return NextResponse.json({ ok: true, email, checked: results.length, summary, results });
}