// app/api/contact/lookup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findPrivacyContact } from "../../../../lib/findPrivacyContact";

function normDomain(d: string) {
  return (d || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].trim();
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isStale(row: any) {
  if (!row?.checked_at) return true;
  const ageMs = Date.now() - new Date(row.checked_at).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return ageMs > thirtyDays || (row.confidence ?? 0) < 60;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const d = normDomain(searchParams.get("domain") || "");
  const force = searchParams.get("force") === "1";
  if (!d) return NextResponse.json({ ok: false, error: "No domain" }, { status: 400 });

  const { data: existing, error: e1 } = await supabase
    .from("vendors_contact")
    .select("*").eq("domain", d).maybeSingle();
  if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });

  const needRefresh = force || !existing || isStale(existing);

  if (!needRefresh) {
    return NextResponse.json({ ok: true, domain: d, contact: existing });
  }

  const result = await findPrivacyContact(d);
  const payload = {
    domain: d,
    contact_type: result.contact_type,
    value: result.value,
    confidence: result.confidence,
    checked_at: new Date().toISOString(),
    meta: result.meta,
  };

  const { data, error } = await supabase
    .from("vendors_contact")
    .upsert(payload, { onConflict: "domain" })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, domain: d, contact: data });
}

export async function POST(req: Request) {
  // behoud je POST voor “always refresh now”
  try {
    const { domain } = await req.json();
    const d = normDomain(domain);
    if (!d) return NextResponse.json({ ok: false, error: "No domain" }, { status: 400 });

    const result = await findPrivacyContact(d);
    const payload = {
      domain: d,
      contact_type: result.contact_type,
      value: result.value,
      confidence: result.confidence,
      checked_at: new Date().toISOString(),
      meta: result.meta,
    };

    const { data, error } = await supabase
      .from("vendors_contact")
      .upsert(payload, { onConflict: "domain" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, domain: d, contact: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown" }, { status: 500 });
  }
}