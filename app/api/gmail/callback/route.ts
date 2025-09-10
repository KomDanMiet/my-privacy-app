export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || origin)
  .trim()
  .replace(/\s+/g, "")   // ← removes any accidental spaces
  .replace(/\/+$/, ""); 
const REDIRECT_URI = `${BASE}/api/gmail/callback`;

type TokenResp = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  expiry_date?: number;
};

async function exchangeCodeForTokens(code: string): Promise<TokenResp> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status}`);
  return (await r.json()) as TokenResp;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state") || "";
    const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    const email = (state?.email || "").toLowerCase().trim();
    const returnTo = state?.returnTo || `/results?email=${encodeURIComponent(email)}`;
    if (!code) throw new Error("missing code");

    const tokens = await exchangeCodeForTokens(code);
    const now = Date.now();
    const tokenRecord = {
      ...tokens,
      expiry_date: tokens.expiry_date ?? (tokens.expires_in ? now + tokens.expires_in * 1000 : undefined),
      fetched_at: new Date().toISOString(),
    };

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await sb.from("gmail_tokens").upsert(
      {
        email,
        token_json: JSON.stringify(tokenRecord),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    return NextResponse.redirect(returnTo, { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "callback error" }, { status: 400 });
  }
}