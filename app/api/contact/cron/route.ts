// app/api/contact/cron/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function ageDays(iso?: string) {
  if (!iso) return 9999;
  return (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

export async function GET(req: Request) {
  // --- AUTH (werkt met UI-headers, vercel.json en handmatige tests) ---
  const url = new URL(req.url);
  const auth = req.headers.get("authorization") || "";
  const qsToken = url.searchParams.get("token") || "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (process.env.CRON_SECRET) {
    const ok =
      isVercelCron ||
      auth === `Bearer ${process.env.CRON_SECRET}` ||
      qsToken === process.env.CRON_SECRET;
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  // --- TEST/PARAMS ---
  const force = url.searchParams.get("force") === "1";         // force recrawl
  const oneDomain = (url.searchParams.get("domain") || "").toLowerCase().trim(); // recrawl specifiek domein
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const minAgeDays = Math.max(0, Number(url.searchParams.get("days") || 30)); // default 30

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let domains: string[] = [];

  if (oneDomain) {
    domains = [oneDomain];
  } else {
    const { data, error } = await sb
      .from("vendors_contact")
      .select("domain, checked_at")
      .order("checked_at", { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    domains = (data || [])
      .filter((r) => force || ageDays(r.checked_at) >= minAgeDays)
      .map((r) => r.domain);
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
  const results: any[] = [];

  for (const d of domains) {
    try {
      const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(d)}&force=1`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      results.push({
        domain: d,
        status: r.status,
        ok: j?.ok,
        type: j?.contact?.contact_type,
        value: j?.contact?.value,
        confidence: j?.contact?.confidence,
      });
      await new Promise((res) => setTimeout(res, 250)); // kleine pauze
    } catch (e: any) {
      results.push({ domain: d, error: e?.message || "fetch failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    count: results.length,
    refreshed: results,
    params: { force, oneDomain, limit, minAgeDays },
  });
}
