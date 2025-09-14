// app/api/gmail/start/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const redirectUri = `${origin.replace(/\/$/, "")}/api/gmail/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,           // your Google OAuth Client ID
    response_type: "code",
    access_type: "offline",                             // get refresh_token
    prompt: "consent",                                  // force refresh_token each time
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ].join(" "),
    redirect_uri: redirectUri,
    // Optional: state for CSRF protection
    // state: crypto.randomUUID(),
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(url);
}