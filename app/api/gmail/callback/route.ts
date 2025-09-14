// app/api/gmail/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * We use the Service Role to write tokens (bypass RLS),
 * and the SSR client (bound to cookies) to know WHICH user is logged in.
 */
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sbService = createClient<Database>(SUPABASE_URL, SERVICE_KEY);

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Shape we’ll store in gmail_tokens.token_json */
type GoogleTokenBundle = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number; // ms since epoch
  raw?: unknown;        // keep the original response too (optional)
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // If Google returned an error, bounce back to settings
  if (error) {
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`/settings?error=no_code`, url.origin));
  }

  // Build redirect_uri exactly as Google received it in /api/gmail/start
  const site = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const redirect_uri = `${site.replace(/\/$/, "")}/api/gmail/callback`;

  // --- 1) Exchange the code for tokens (Google) -----------------------------
  const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson?.access_token) {
    return NextResponse.redirect(
      new URL(`/settings?error=token_exchange_failed`, url.origin),
    );
  }

  const accessToken: string = tokenJson.access_token as string;

  // --- 2) Get the Gmail account's email (profile) ---------------------------
  const profileRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json().catch(() => null);

  const connectedEmail: string | undefined =
    (profile && (profile.email as string)) ||
    (tokenJson.id_token ? decodeEmailFromIdToken(tokenJson.id_token) : undefined);

  // --- 3) Figure out WHICH Supabase user is logged in ----------------------
  const jar = await cookies();
  const supaSSR = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => jar.get(name)?.value,
        set: (name: string, value: string, options: any) =>
          jar.set({ name, value, ...(options ?? {}) }),
        remove: (name: string, options: any) =>
          jar.set({ name, value: "", ...(options ?? {}) }),
      },
    }
  );

  const {
    data: { user },
    error: userErr,
  } = await supaSSR.auth.getUser();

  if (userErr || !user) {
    return NextResponse.redirect(new URL(`/settings?error=no_user`, url.origin));
  }

  // --- 4) Persist tokens tied to THIS user_id -------------------------------
  const bundle: GoogleTokenBundle = {
    access_token: accessToken,
    refresh_token: tokenJson.refresh_token,
    scope: tokenJson.scope,
    token_type: tokenJson.token_type,
    expiry_date:
      typeof tokenJson.expires_in === "number"
        ? Date.now() + tokenJson.expires_in * 1000
        : undefined,
    raw: tokenJson,
  };

  const { error: upsertErr } = await sbService
    .from("gmail_tokens")
    .upsert(
      {
        user_id: user.id,                 // ✅ IMPORTANT: store user_id
        email: connectedEmail ?? "",
        token_json: bundle as any,
      },
      { onConflict: "user_id" }           // one row per signed-in user
    );

  if (upsertErr) {
    // Optional: log to Vercel logs
    console.error("gmail_tokens upsert error:", upsertErr);
    return NextResponse.redirect(new URL(`/settings?error=save_failed`, url.origin));
  }

  // --- 5) Done: back to settings (or dashboard) -----------------------------
  return NextResponse.redirect(new URL(`/settings?gmail=connected`, url.origin));
}

/** Best-effort parse of email from an ID token (when userinfo fails). */
function decodeEmailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return json?.email as string | undefined;
  } catch {
    return undefined;
  }
}