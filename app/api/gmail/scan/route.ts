export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/gmail/scan { email }
 * Runs a discovery scan for the user's inbox and marks scanned_at.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normEmail = String(email || "").toLowerCase().trim();
    if (!normEmail) {
      return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, KEY);

    // 1) run your existing scan (replace this with your real logic)
    // Example: kick off a worker or call your internal endpoint
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/discovery/gmail/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: normEmail }),
      });
    } catch (e) {
      console.warn("[/api/gmail/scan] scan trigger failed (continuing):", e);
    }

    // 2) mark scanned_at now (or after scan finishes if you want to be strict)
    const { error } = await sb
      .from("gmail_tokens")
      .update({ scanned_at: new Date().toISOString() })
      .eq("email", normEmail);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/gmail/scan] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}