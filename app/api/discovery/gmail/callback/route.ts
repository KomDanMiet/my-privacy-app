export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { oauthClient, verifyState } from "@/lib/google";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.json({ ok: false, error: "Missing code/state" }, { status: 400 });
  }
  const state = verifyState(stateParam);
  if (!state?.email) {
    return NextResponse.json({ ok: false, error: "Bad state" }, { status: 400 });
  }

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // bewaar tokens (bewaar oude refresh_token als Google nu geen nieuwe stuurt)
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: existing } = await sb
    .from("gmail_tokens")
    .select("token_json")
    .eq("email", state.email)
    .maybeSingle();

  const token_json = {
    ...(existing?.token_json ?? {}),
    ...tokens,
    // expiry_date komt vaak als millis (number). Laat het gewoon in JSON.
  };

  await sb.from("gmail_tokens").upsert({
    email: state.email,
    token_json,
  });

  return NextResponse.json({
    ok: true,
    connected: true,
    email: state.email,
    scope: tokens.scope ?? null,
  });
}