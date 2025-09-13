// app/api/gmail/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

const sb = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state"); // we set this in /start

  if (!code || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/settings?err=nocode`);
  }

  // 1) Exchange code for tokens
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/callback`,
    grant_type: "authorization_code",
  });

  const r = await fetch(TOKEN_URL, { method: "POST", body });
  const t = await r.json();

  if (!r.ok || !t?.access_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/settings?err=token`);
  }

  // 2) Get email address
  const userinfo = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${t.access_token}` },
  }).then(res => res.json()).catch(() => null);

  const email = userinfo?.email || null;

  // 3) Save token bundle
  const token_json = {
    access_token: t.access_token as string,
    refresh_token: t.refresh_token as string | undefined,
    expiry_date: typeof t.expires_in === "number" ? Date.now() + t.expires_in * 1000 : undefined,
  };

  await sb.from("gmail_tokens").upsert({
    user_id: userId,
    email: email ?? "",
    token_json: token_json as any,
  }, { onConflict: "user_id" });

  // 4) Done → back to settings (or directly kick a scan)
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/settings?connected=1`);
}