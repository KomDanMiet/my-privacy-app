// app/api/gmail/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service client for DB writes (no cookies)
const sb = createServiceClient<Database>(SUPABASE_URL, SERVICE_KEY);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");

  const origin = url.origin;
  const redirectUri = `${origin}/api/gmail/callback`;

  const jar = await cookies();
  const savedState = jar.get("gmail_oauth_state")?.value || null;
  // clear state cookie
  jar.set({ name: "gmail_oauth_state", value: "", path: "/", maxAge: 0 });

  if (err) {
    return NextResponse.redirect(`${origin}/settings?connect_error=${encodeURIComponent(err)}`, { status: 302 });
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?connect_error=no_code_in_callback`, { status: 302 });
  }
  if (!returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(`${origin}/settings?connect_error=state_mismatch`, { status: 302 });
  }

  // Exchange code for tokens
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tr = await fetch(TOKEN_URL, { method: "POST", body });
  const tj = await tr.json();
  if (!tr.ok || !tj?.access_token) {
    return NextResponse.redirect(`${origin}/settings?connect_error=token_exchange_failed`, { status: 302 });
  }

  // Fetch user email to display
  const ur = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tj.access_token}` },
  });
  const uj = await ur.json();
  const gmailEmail: string | undefined = uj?.email;

  // Read current signed-in user (SSR client bound to cookies)
  const supa = createSSRClient<Database>(SUPABASE_URL, ANON_KEY, {
    cookies: {
      get(name: string) {
        return jar.get(name)?.value;
      },
      set(name: string, value: string, options?: any) {
        jar.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options?: any) {
        jar.set({ name, value: "", ...(options ?? {}) });
      },
    },
  });

  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/signin?msg=please_sign_in_first`, { status: 302 });
  }

  // Upsert Gmail token record
  await sb
    .from("gmail_tokens")
    .upsert(
      {
        user_id: user.id,
        email: gmailEmail || "unknown",
        token_json: tj, // contains access_token, maybe refresh_token, expiry, etc.
        scanning: false,
        scanned_at: null,
      } as any,
      { onConflict: "user_id" }
    );

  return NextResponse.redirect(`${origin}/settings?connected=gmail`, { status: 302 });
}