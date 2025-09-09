// app/api/discovery/gmail/callback/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { oauthClient, verifyState } from "@/lib/google";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !state) {
      return NextResponse.json({ ok: false, error: "Missing code/state" }, { status: 400 });
    }

    const parsed = verifyState(state);
    if (!parsed?.email) {
      return NextResponse.json({ ok: false, error: "Bad state" }, { status: 400 });
    }
    const email = String(parsed.email).toLowerCase().trim();

    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return NextResponse.json({ ok: false, error: "No tokens from Google" }, { status: 502 });
    }

    // vraag nog even de eigen e-mail op via Google (ter validatie)
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const me = await oauth2.userinfo.get().catch(() => null);
    const googleEmail = (me?.data?.email || "").toLowerCase();

    if (googleEmail && googleEmail !== email) {
      // we slaan alsnog onder de “state”-email op (jij bepaalt de key);
      // je kunt hier ook switchen naar googleEmail als je wilt
    }

    const sb = sbAdmin();
    const { error: upErr } = await sb
      .from("gmail_tokens")
      .upsert({ email, token_json: tokens }, { onConflict: "email" });

    if (upErr) {
      // laat de fout zien zodat je hem in Vercel Logs terugziet
      console.error("gmail_tokens upsert error:", upErr);
      return NextResponse.json(
        { ok: false, error: `DB upsert failed: ${upErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      email,
      scope: tokens.scope || "https://www.googleapis.com/auth/gmail.readonly",
      stored: true,
    });
  } catch (e: any) {
    console.error("[gmail/callback] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}