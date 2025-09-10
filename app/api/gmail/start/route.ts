export const runtime = "edge";

import { NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const BASE = process.env.NEXT_PUBLIC_BASE_URL!; // e.g. https://discodruif.com
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const REDIRECT_URI = `${BASE}/api/gmail/callback`;

function uid(n = 32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  crypto.getRandomValues(new Uint8Array(n)).forEach(b => (s += alphabet[b % alphabet.length]));
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").toLowerCase().trim();

  const state = Buffer.from(
    JSON.stringify({
      email,
      returnTo: url.searchParams.get("returnTo") || `/results?email=${encodeURIComponent(email)}`,
      nonce: uid(12),
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