// app/api/contact/cron/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function ageDays(iso?: string) {
  if (!iso) return 9999;
  return (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await sb
    .from("vendors_contact")
    .select("domain, checked_at")
    .order("checked_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
  const due = (data || []).filter(r => ageDays(r.checked_at) >= 30).map(r => r.domain);
  const results: any[] = [];

  for (const d of due) {
    try {
      const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(d)}&force=1`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      results.push({ d, status: r.status, ok: j?.ok, type: j?.contact?.contact_type, val: j?.contact?.value });
      await new Promise(res => setTimeout(res, 250));
    } catch (e: any) {
      results.push({ d, err: e?.message || "fetch failed" });
    }
  }

  return NextResponse.json({ ok: true, refreshed: results });
}
