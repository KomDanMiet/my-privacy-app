// app/api/gmail/start/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const site = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const redirect_uri = `${site.replace(/\/$/, "")}/api/gmail/callback`;

  const authUrl = new URL(GOOGLE_AUTH);
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // ensure refresh_token
  authUrl.searchParams.set("scope", SCOPES);
  // Optionally pass state=… if you want CSRF protection

  return NextResponse.redirect(authUrl.toString(), { status: 302 });
}