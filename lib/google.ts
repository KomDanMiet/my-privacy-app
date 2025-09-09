// lib/google.ts
import { google } from "googleapis";
import crypto from "crypto";

export function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${baseUrl()}/api/discovery/gmail/callback`
  );
}

// Sign/verify state zodat niemand kan rommelen met de e-mail
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
