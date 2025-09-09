export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { oauthClient, verifyState, BASE_URL } from "@/lib/google";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";

    // 1) verify signed state
    const st = verifyState(state); // -> { email, ts } | null
    if (!st) {
      return NextResponse.json({ ok: false, error: "Bad state" }, { status: 400 });
    }

    const client = oauthClient();

    // 2) token exchange
    const { tokens } = await client.getToken(code);
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return NextResponse.json({ ok: false, error: "No tokens from Google" }, { status: 502 });
    }
    client.setCredentials(tokens);

    // 3) determine user email (Gmail profile first, then userinfo, then state)
    const gmail = google.gmail({ version: "v1", auth: client });
    let email: string = st.email || "";

    try {
      const prof = await gmail.users.getProfile({ userId: "me" });
      if (prof?.data?.emailAddress) email = prof.data.emailAddress;
    } catch { /* ignore */ }

    if (!email) {
      try {
        const oauth2 = google.oauth2({ auth: client, version: "v2" });
        const me = await oauth2.userinfo.get();
        email = me?.data?.email || email;
      } catch { /* ignore */ }
    }

    if (!email) {
      return NextResponse.json({ ok: false, error: "Could not determine email" }, { status: 400 });
    }

    // 4) persist tokens
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
          expires_at:
            tokens.expiry_date ??
            (typeof (tokens as any).expires_in === "number"
              ? Date.now() + (tokens as any).expires_in * 1000
              : null),
          scope: tokens.scope ?? "https://www.googleapis.com/auth/gmail.readonly",
        },
        { onConflict: "email" }
      );

    // 5) kick off a first scan (best effort, non-blocking)
    try {
      await fetch(`${BASE_URL}/api/discovery/gmail/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, days: 365, max: 1200 }),
        cache: "no-store",
      });
    } catch {
      // ignore
    }

    // 6) redirect to results
    return NextResponse.redirect(
      `${BASE_URL}/results?email=${encodeURIComponent(email)}`,
      { status: 302 }
    );
  } catch (e: any) {
    console.error("[gmail/callback] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}