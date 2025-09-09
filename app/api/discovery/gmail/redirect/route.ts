export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";
  return NextResponse.redirect(buildAuthUrl(email), { status: 302 });
}