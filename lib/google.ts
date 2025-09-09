// lib/google.ts
import { google } from "googleapis";
import crypto from "crypto";

/** Lees BASE_URL uit env en maak 'm veilig (trim + geen trailing slash). */
const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";

export const BASE_URL = RAW_BASE_URL.trim().replace(/\/+$/, "");

/** OAuth client met correcte redirect URI. */
export function oauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${BASE_URL}/api/discovery/gmail/callback`;

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Handige debuglog; mag je weghalen
  console.log("[oauth] redirectUri =", redirectUri);

  return client;
}

/** Sign/verify van state zodat er niet met ?state gerommeld kan worden. */
export function signState(obj: any) {
  const secret = process.env.APP_SECRET || "dev-secret";
  const json = JSON.stringify(obj);
  const sig = crypto.createHmac("sha256", secret).update(json).digest("base64url");
  return Buffer.from(JSON.stringify({ json, sig })).toString("base64url");
}

export function verifyState(stateB64: string) {
  try {
    const decoded = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf8"));
    const { json, sig } = decoded || {};
    const secret = process.env.APP_SECRET || "dev-secret";
    const expect = crypto.createHmac("sha256", secret).update(json).digest("base64url");
    if (sig !== expect) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Optioneel: helper om de auth-URL te bouwen. */
export function buildAuthUrl(email: string) {
  const client = oauthClient();
  const state = signState({ email, ts: Date.now() });
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    include_granted_scopes: true,
    prompt: "consent",
    state,
  });
}