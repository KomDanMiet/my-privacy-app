// app/api/gmail/start/route.ts
export const runtime = "edge";
import { NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").toLowerCase().trim();

  // Clean, absolute base
  const origin = url.origin;
  const BASE = (process.env.NEXT_PUBLIC_BASE_URL || origin)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\/+$/, "");

  const REDIRECT_URI = `${BASE}/api/gmail/callback`;
  const returnToAbs = `${BASE}/results?email=${encodeURIComponent(email)}`;

  // ⬇️ Use ABSOLUTE returnTo here
  const state = Buffer.from(
    JSON.stringify({
      email,
      returnTo: url.searchParams.get("returnTo") || returnToAbs,
    }),
    "utf8"
  ).toString("base64url");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString(), { status: 302 });
}
