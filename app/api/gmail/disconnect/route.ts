export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function googleRevoke(token?: string | null) {
  if (!token) return;
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout?.(5000),
    });
  } catch {}
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const userEmail = String(email || "").toLowerCase().trim();
    if (!userEmail) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb
      .from("gmail_tokens")
      .select("token_json")
      .eq("email", userEmail)
      .maybeSingle();
    if (error) throw error;

    if (data?.token_json) {
      try {
        const t = JSON.parse(data.token_json);
        await googleRevoke(t?.access_token);
        await googleRevoke(t?.refresh_token);
      } catch {}
    }

    const { error: delErr } = await sb.from("gmail_tokens").delete().eq("email", userEmail);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "POST { email } to disconnect" });
}