import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
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

    // token_json may be TEXT (stringified JSON) or JSONB (object)
    const raw = data.token_json as any;
    const token =
      typeof raw === "string"
        ? JSON.parse(raw)
        : raw && typeof raw === "object"
        ? raw
        : {};

    // Freshness:
    // - prefer absolute ms timestamp `expiry_date` if present
    // - otherwise, derive from (row timestamp + expires_in)
    let expiryMs = 0;
    if (typeof token.expiry_date === "number") {
      expiryMs = token.expiry_date;
    } else if (typeof token.expires_in === "number") {
      const base = new Date(data.updated_at || data.created_at).getTime();
      expiryMs = base + token.expires_in * 1000;
    }

    const isFresh = expiryMs > Date.now();
    return NextResponse.json({ ok: true, hasToken: true, isFresh });
  } catch (e: any) {
    console.error("[status] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}