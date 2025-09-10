export const runtime = "edge";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  const nowIso = new Date().toISOString();
  console.log("[GMAIL CALLBACK] hit", { nowIso, url: req.url });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";

  if (!code) {
    console.error("[GMAIL CALLBACK] missing code");
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  let state: any = {};
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
  } catch (e) {
    console.error("[GMAIL CALLBACK] failed to parse state", e);
  }
  const email = (state.email || "").toLowerCase().trim();
  const returnTo = state.returnTo || "/";

  console.log("[GMAIL CALLBACK] parsed state", { email, returnTo });

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json().catch(() => ({}));
  console.log("[GMAIL CALLBACK] token exchange result", {
    ok: tokenRes.ok,
    status: tokenRes.status,
    hasAccess: !!tokens.access_token,
    hasRefresh: !!tokens.refresh_token,
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ ok: false, error: tokens.error || "Token exchange failed" }, { status: 400 });
  }

  // Save token JSON in Supabase
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await sb.from("gmail_tokens").upsert({
      email,
      token_json: tokens,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[GMAIL CALLBACK] supabase upsert error", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log("[GMAIL CALLBACK] token upserted for", email);
  } catch (e) {
    console.error("[GMAIL CALLBACK] supabase error", e);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }

  // Redirect back to results page (absolute URL!)
  const absoluteReturn = returnTo.startsWith("http")
    ? returnTo
    : `${url.origin}${returnTo}`;

  console.log("[GMAIL CALLBACK] redirecting user", { absoluteReturn });

  return NextResponse.redirect(absoluteReturn, { status: 302 });
}
