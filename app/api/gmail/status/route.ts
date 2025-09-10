
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  console.log("[status] checking for email:", email);

  try {
    const sb = createClient(SUPABASE_URL, KEY);

    const { data, error } = await sb
      .from("gmail_tokens")
      .select("token_json, created_at, updated_at")
      .eq("email", email)
      .maybeSingle();

    console.log("[status] Supabase result:", { data, error });

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ ok: true, hasToken: false, isFresh: false });
    }

    let isFresh = false;
    try {
      const parsed = JSON.parse(data.token_json || "{}");
      const expiry = parsed.expiry_date ? Number(parsed.expiry_date) : 0;
      isFresh = expiry > Date.now();
      console.log("[status] Parsed token expiry:", expiry, "Now:", Date.now());
    } catch (e) {
      console.error("[status] JSON parse error:", e);
    }

    return NextResponse.json({ ok: true, hasToken: true, isFresh });
  } catch (e: any) {
    console.error("[status] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}