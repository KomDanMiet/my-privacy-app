// app/api/gmail/disconnect/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Best effort: ask Google to revoke a token
async function googleRevoke(token?: string | null) {
  if (!token) return;
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      // small timeout
      signal: AbortSignal.timeout?.(5000),
    });
  } catch {
    // ignore network errors; we'll still delete locally
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const userEmail = String(email || "").toLowerCase().trim();
    if (!userEmail) {
      return NextResponse.json(
        { ok: false, error: "Missing email" },
        { status: 400 }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) read current tokens (if any)
    const { data: rows, error: selErr } = await sb
      .from("gmail_tokens")
      .select("access_token, refresh_token")
      .eq("email", userEmail);

    if (selErr) throw selErr;

    // 2) best-effort revoke at Google (both access & refresh if present)
    if (rows && rows.length) {
      for (const r of rows) {
        await googleRevoke(r?.access_token);
        await googleRevoke(r?.refresh_token);
      }
    }

    // 3) delete local tokens
    const { error: delErr } = await sb
      .from("gmail_tokens")
      .delete()
      .eq("email", userEmail);

    if (delErr) throw delErr;

    // (Optional) clear any cached discovery results you store per user
    // await sb.from("discovered_senders").delete().eq("email", userEmail);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST { email } to revoke Gmail access and delete local tokens",
  });
}
