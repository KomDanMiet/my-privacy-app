// app/api/gmail/callback/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function baseFrom(url: URL) {
  // Mirror /api/gmail/start construction to avoid redirect_uri mismatches
  return (process.env.NEXT_PUBLIC_BASE_URL || url.origin)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\/+$/, "");
}

export async function GET(req: Request) {
  const nowIso = new Date().toISOString();
  const url = new URL(req.url);
  const BASE = baseFrom(url);
  const REDIRECT_URI = `${BASE}/api/gmail/callback`;

  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  // Decode state (email + returnTo)
  let email = "";
  let returnTo = "/";

  try {
    const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) || {};
    email = String(state.email || "").toLowerCase().trim();
    // prevent open redirects: only allow relative paths
    if (typeof state.returnTo === "string" && state.returnTo.startsWith("/")) {
      returnTo = state.returnTo;
    } else if (email) {
      returnTo = `/results?email=${encodeURIComponent(email)}`;
    }
  } catch {
    // fallback to results if state malformed
    returnTo = "/results";
  }

  // Exchange code → tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

  const tokens: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return NextResponse.json(
      { ok: false, error: tokens?.error || "Token exchange failed" },
      { status: 400 }
    );
  }

  // Normalize token: compute absolute expiry_date when missing
  const expiry_date =
    typeof tokens.expiry_date === "number"
      ? Number(tokens.expiry_date)
      : tokens.expires_in
      ? Date.now() + Number(tokens.expires_in) * 1000
      : undefined;

  const tokenJson = {
    ...tokens,
    expiry_date,
    token_type: tokens.token_type || "Bearer",
    scope: tokens.scope || "https://www.googleapis.com/auth/gmail.readonly",
  };

  // Persist to Supabase (JSON/JSONB column recommended)
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await sb
      .from("gmail_tokens")
      .upsert(
        {
          email,
          token_json: tokenJson,
          scanned_at: null,              // reset so a fresh scan can run
          created_at: nowIso,            // will be ignored on conflict if you prefer
          updated_at: nowIso,
        },
        { onConflict: "email" }
      );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "DB error" }, { status: 500 });
  }

  // Absolute redirect, but keep it on our own origin/base
  const redirectUrl = returnTo.startsWith("http") ? `${BASE}/results` : `${BASE}${returnTo}`;
  return NextResponse.redirect(redirectUrl, { status: 302 });
}