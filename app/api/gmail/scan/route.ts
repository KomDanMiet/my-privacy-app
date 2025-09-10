// app/api/gmail/scan/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const { email, force } = await req.json();
    const normEmail = String(email || "").toLowerCase().trim();
    if (!normEmail) {
      return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, KEY);

    // Check existing scanned_at
    const { data: existing, error: selErr } = await sb
      .from("gmail_tokens")
      .select("scanned_at")
      .eq("email", normEmail)
      .maybeSingle();
    if (selErr) throw selErr;

    // If not forcing and already scanned → no-op (keeps UI snappy)
    if (!force && existing?.scanned_at) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Build a safe absolute base for the internal call
    const origin = new URL(req.url).origin;
    const BASE = (process.env.NEXT_PUBLIC_BASE_URL || origin)
      .trim()
      .replace(/\s+/g, "")
      .replace(/\/+$/, "");

    // Kick the real scan (best-effort)
    let downstreamOk = false;
    try {
      const r = await fetch(`${BASE}/api/discovery/gmail/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: normEmail }),
      });
      const j = await r.json().catch(() => ({}));
      downstreamOk = r.ok && !!j?.ok;
    } catch (e) {
      console.warn("[scan] downstream scan trigger failed:", e);
    }

    // Mark scanned_at now so the UI stops auto-scanning.
    // (If you prefer, only set this when downstreamOk === true.)
    const { error: updErr } = await sb
      .from("gmail_tokens")
      .update({ scanned_at: new Date().toISOString() })
      .eq("email", normEmail);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, downstreamOk });
  } catch (e: any) {
    console.error("[scan] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
