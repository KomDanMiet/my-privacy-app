export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (!code) {
    return NextResponse.redirect(new URL(next, req.url));
  }

  const supabase = createRouteHandlerClient({ cookies });
  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch (err) {
    const dbg = new URL("/auth/debug", req.url);
    dbg.searchParams.set("err", (err && (err as Error).message) || "exchange_failed");
    return NextResponse.redirect(dbg);
  }

  return NextResponse.redirect(new URL(next, req.url));
}
