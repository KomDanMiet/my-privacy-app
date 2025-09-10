export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  try {
    const sb = createClient(SUPABASE_URL, KEY);

    const { data, error } = await sb
      .from("gmail_tokens")
      .select("token_json, scanned_at")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      return NextResponse.json({ ok: true, hasToken: false, isFresh: false, scannedAt: null });
    }

    // token_json might be JSON (object) or JSON text (string) depending on insert code
    const raw = data.token_json;
    const obj = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {});
    const expiry = Number(obj?.expiry_date ?? 0);
    const isFresh = expiry > Date.now();

    return NextResponse.json({
      ok: true,
      hasToken: true,
      isFresh,
      scannedAt: data.scanned_at ?? null,
    });
  } catch (e: any) {
    console.error("[/api/gmail/status] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}