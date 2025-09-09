export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { oauthClient, verifyState, baseUrl } from "@/lib/google";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ ok: false, error: "Missing code/state" }, { status: 400 });
  }

  const parsed = verifyState(state);
  if (!parsed?.email) {
    return NextResponse.json({ ok: false, error: "Invalid state" }, { status: 400 });
  }
  const userEmail: string = parsed.email;

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens?.access_token) {
    return NextResponse.json({ ok: false, error: "No access token" }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await sb.from("gmail_tokens").upsert({
    user_email: userEmail,
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expiry_date: tokens.expiry_date ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_email" });

  // terug naar results (of jouw gewenste pagina)
  const redirect = `${baseUrl()}/results?email=${encodeURIComponent(userEmail)}&connected=gmail`;
  return NextResponse.redirect(redirect);
}
