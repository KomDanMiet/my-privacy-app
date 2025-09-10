export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normEmail = String(email || "").toLowerCase().trim();
    if (!normEmail) {
      return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, KEY);

    // If already scanned, do nothing
    const { data: existing, error: selErr } = await sb
      .from("gmail_tokens")
      .select("scanned_at")
      .eq("email", normEmail)
      .maybeSingle();
    console.log("[scan] existing row:", existing, selErr);
    if (selErr) throw selErr;

    if (existing?.scanned_at) {
      console.log("[scan] already scanned; skipping");
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Kick the real scan (best-effort)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/discovery/gmail/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: normEmail }),
      });
    } catch (e) {
      console.warn("[scan] scan trigger failed (continuing):", e);
    }

    // Mark scanned_at now to stop the loop
    const { error: updErr } = await sb
      .from("gmail_tokens")
      .update({ scanned_at: new Date().toISOString() })
      .eq("email", normEmail);
    console.log("[scan] update scanned_at:", updErr);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[scan] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
