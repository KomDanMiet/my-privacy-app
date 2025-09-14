// app/api/gmail/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sbService = createClient<Database>(SUPABASE_URL, SERVICE_KEY);

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

type GoogleTokenBundle = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
  raw?: unknown;
};

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const error = u.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error)}`, u.origin));
  if (!code) return NextResponse.redirect(new URL(`/settings?error=no_code`, u.origin));

  const site = process.env.NEXT_PUBLIC_SITE_URL || u.origin;
  const redirect_uri = `${site.replace(/\/$/, "")}/api/gmail/callback`;

  // 1) Exchange code -> tokens
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
    return NextResponse.redirect(new URL(`/settings?error=token_exchange_failed`, u.origin));
  }

  // 2) Get Gmail email
  const profileRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenJson.access_token as string}` },
  });
  const profile = await profileRes.json().catch(() => null);
  const connectedEmail: string | undefined =
    (profile?.email as string | undefined) ?? (tokenJson.id_token ? decodeEmailFromIdToken(tokenJson.id_token) : undefined);

 // 3) Who is logged in? Bind SSR client to cookies (getAll/setAll)
const jar = await cookies(); // ✅ await in Route Handlers (Next 15)

const supaSSR = createServerClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll: () =>
        jar.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (list) => {
        list.forEach(({ name, value, ...options }) => {
          jar.set({ name, value, ...(options as any) });
        });
      },
    },
  }
);

  const { data: { user } } = await supaSSR.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/settings?error=no_user`, u.origin));

  // 4) Save tokens for THIS user
  const bundle: GoogleTokenBundle = {
    access_token: tokenJson.access_token as string,
    refresh_token: tokenJson.refresh_token,
    scope: tokenJson.scope,
    token_type: tokenJson.token_type,
    expiry_date: typeof tokenJson.expires_in === "number" ? Date.now() + tokenJson.expires_in * 1000 : undefined,
    raw: tokenJson,
  };

  const { error: upsertErr } = await sbService
    .from("gmail_tokens")
    .upsert(
      {
        user_id: user.id,               // ✅ now stored
        email: connectedEmail ?? "",
        token_json: bundle as any,
      },
      { onConflict: "user_id" }
    );

  if (upsertErr) {
    console.error("gmail_tokens upsert error:", upsertErr);
    return NextResponse.redirect(new URL(`/settings?error=save_failed`, u.origin));
  }

  return NextResponse.redirect(new URL(`/settings?gmail=connected`, u.origin));
}

function decodeEmailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return json?.email as string | undefined;
  } catch {
    return undefined;
  }
}