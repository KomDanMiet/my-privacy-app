import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const redirectUri = `${site}/api/gmail/callback`;

  // Generate CSRF state
  const state = Math.random().toString(36).slice(2);

  // Save state in a short-lived cookie (httpOnly not required for this simple check)
  const jar = await cookies();
  jar.set("gmail_oauth_state", state, {
    path: "/",
    maxAge: 60 * 10, // 10 min
    sameSite: "lax",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ].join(" "),
    prompt: "consent", // ensures refresh_token the first time
    state,
  });

  const url = `${GOOGLE_AUTH}?${params.toString()}`;
  return NextResponse.redirect(url, { status: 302 });
}