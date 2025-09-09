// app/api/discovery/gmail/callback/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { oauthClient, verifyState, BASE_URL } from "@/lib/google";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code  = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";

    // 1) Verify signed state (HMAC) that we created in buildAuthUrl(email)
    const st = verifyState(state); // => { email, ts } or null
    if (!st) {
      return NextResponse.json({ ok: false, error: "Bad state" }, { status: 400 });
    }

    const client = oauthClient();

    // 2) Exchange code for tokens
    const { tokens } = await client.getToken(code);
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return NextResponse.json({ ok: false, error: "No tokens from Google" }, { status: 502 });
    }
    client.setCredentials(tokens);

    // 3) Determine the user’s email (prefer Google profile)
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const me = await oauth2.userinfo.get().catch(() => null);
    const email =
      me?.data?.email ||
      st.email || // fallback to email we embedded in state
      "";

    if (!email) {
      return NextResponse.json({ ok: false, error: "Could not determine email" }, { status: 400 });
    }

    // 4) Persist tokens in Supabase
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await sb
  .from("gmail_tokens")
  .upsert(
    {
      email,
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expiry_date
        ?? (typeof (tokens as any).expires_in === "number"
              ? Date.now() + (tokens as any).expires_in * 1000
              : null),
      scope: tokens.scope ?? "https://www.googleapis.com/auth/gmail.readonly",
    },
    { onConflict: "email" }
  );

    // 5) Redirect to results
    const target = `${BASE_URL}/results?email=${encodeURIComponent(email)}`;
    return NextResponse.redirect(target, { status: 302 });
  } catch (e: any) {
    console.error("[gmail/callback] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}