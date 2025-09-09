// app/api/discovery/gmail/callback/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { oauthClient, verifyState } from "@/lib/google";
// (optioneel) import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.json({ ok: false, error: "Missing code/state" }, { status: 400 });
  }

  const state = verifyState(stateParam);
  if (!state) {
    return NextResponse.json({ ok: false, error: "Bad state" }, { status: 400 });
  }

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // TODO: sla tokens op indien je ze wilt bewaren voor batch-scan:
  // const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // await supabase.from("gmail_tokens").upsert({ email: state.email, tokens });

  return NextResponse.json({
    ok: true,
    connected: true,
    email: state.email ?? null,
    scope: tokens.scope ?? null,
  });
}