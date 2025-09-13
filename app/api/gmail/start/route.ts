// app/api/gmail/start/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
  "profile",
].join(" ");

export async function GET(req: Request) {
  // Build redirect_uri from the request origin (no env needed)
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/gmail/callback`;

  // CSRF: create and store state
  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set({
    name: "gmail_oauth_state",
    value: state,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 60 * 10, // 10 min
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES,
    access_type: "offline",      // ask for refresh_token
    prompt: "consent",           // force consent to ensure refresh_token on first connect
    include_granted_scopes: "true",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl, { status: 302 });
}