// app/api/contact/lookup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findPrivacyContact } from "../../../../lib/findPrivacyContact";

function normDomain(d: string) {
  return (d || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].trim();
}

const MIN_CONF = Number(process.env.DSAR_MIN_CONF ?? 60);
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

function isStale(row: any) {
  if (!row?.checked_at) return true;
  const age = Date.now() - new Date(row.checked_at).getTime();
  return age > STALE_MS || (row.confidence ?? 0) < MIN_CONF;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const d = normDomain(searchParams.get("domain") || "");
  const force = searchParams.get("force") === "1";
  const allowDowngrade = searchParams.get("downgrade") === "1";
  if (!d) return NextResponse.json({ ok: false, error: "No domain" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await sb
    .from("vendors_contact")
    .select("*")
    .eq("domain", d)
    .maybeSingle();

  if (!force && existing && !isStale(existing)) {
    return NextResponse.json({ ok: true, domain: d, contact: existing });
  }

  const probed = await findPrivacyContact(d);

  // sticky merge
  const hadGoodEmail =
    existing?.contact_type === "email" && (existing?.confidence ?? 0) >= MIN_CONF;
  const probedIsGoodEmail =
    probed.contact_type === "email" && (probed.confidence ?? 0) >= MIN_CONF;

  const next = {
    domain: d,
    contact_type: probed.contact_type,
    value: probed.value,
    confidence: probed.confidence,
    checked_at: new Date().toISOString(),
    last_bounce_at: existing?.last_bounce_at ?? null,
    bounce_reason: existing?.bounce_reason ?? null,
    bounce_count: existing?.bounce_count ?? 0,
    meta: probed.meta,
  } as any;

  if (!allowDowngrade && hadGoodEmail && !probedIsGoodEmail) {
    next.contact_type = existing.contact_type;
    next.value = existing.value;
    next.confidence = existing.confidence;
  }

  const { data, error } = await sb
    .from("vendors_contact")
    .upsert(next, { onConflict: "domain" })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, domain: d, contact: data });
}
