import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient<Database>(SUPABASE_URL, SERVICE_KEY);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");

  // Read & clear the stored state
  const jar = await cookies();
  const savedState = jar.get("gmail_oauth_state")?.value || null;
  jar.set("gmail_oauth_state", "", { path: "/", maxAge: 0 });

  if (error) {
    // User denied or Google error
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?connect_error=${encodeURIComponent(error)}`,
      { status: 302 }
    );
  }

  if (!code) {
    // Most common reasons: redirect_uri mismatch, wrong client, or you hit a different domain
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?connect_error=${encodeURIComponent("no_code_in_callback")}`,
      { status: 302 }
    );
  }

  if (!returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?connect_error=${encodeURIComponent("state_mismatch")}`,
      { status: 302 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/callback`;

  // Exchange code for tokens
  const tokenBody = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tr = await fetch(TOKEN_URL, { method: "POST", body: tokenBody });
  const tj = await tr.json();

  if (!tr.ok || !tj.access_token) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings?connect_error=${encodeURIComponent("token_exchange_failed")}`,
      { status: 302 }
    );
  }

  // Basic user info (email) to associate the Gmail account
  const ur = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tj.access_token}` },
  });
  const uj = await ur.json();
  const gmailEmail: string | undefined = uj?.email;

  // Get the signed-in app user (from Supabase cookie session)
  // We don’t mutate cookies here, just read
  const supa = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // READ-ONLY in route handlers is fine; we are not setting here
        getAll: () => jar.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/auth/signin?msg=${encodeURIComponent("please_sign_in_first")}`,
      { status: 302 }
    );
  }

  // Store tokens in your table (gmail_tokens.token_json is JSON)
  await sb
    .from("gmail_tokens")
    .upsert(
      {
        user_id: user.id,
        email: gmailEmail || "unknown",
        token_json: tj, // contains access_token, refresh_token (first consent), expiry info, etc.
        scanned_at: null,
        scanning: false,
      } as any,
      { onConflict: "user_id" }
    );

  // All good → back to settings
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/settings?connected=gmail`, {
    status: 302,
  });
}