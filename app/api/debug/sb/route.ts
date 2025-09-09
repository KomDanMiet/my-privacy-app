// app/api/debug/sb/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const sb = createClient(URL, SRK);
    const email = "debug@local";
    const payload = { foo: "bar", at: new Date().toISOString() };

    const { error } = await sb
      .from("gmail_tokens")
      .upsert({ email, token_json: payload }, { onConflict: "email" });

    if (error) throw error;
    return NextResponse.json({ ok: true, wrote: email });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "err" }, { status: 500 });
  }
}