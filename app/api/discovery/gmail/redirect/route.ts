// app/api/discovery/gmail/redirect/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";

  // Bouw de Google OAuth URL (met gesigneerde state)
  const authUrl = buildAuthUrl(email);

  // Stuur door naar Google
  return NextResponse.redirect(authUrl, { status: 302 });
}