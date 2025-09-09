import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";

  const { oAuth2Client } = oauthClient();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    include_granted_scopes: true,
    prompt: "consent",
    state: JSON.stringify({ email }),
  });

  return NextResponse.redirect(authUrl, { status: 302 });
}