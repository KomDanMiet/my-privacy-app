// app/api/gmail/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseInRoute } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  // Create SSR client with response-bound cookies
  const res = NextResponse.next();
  const supaSSR = await getSupabaseInRoute(res);

  // Start OAuth with Supabase Auth (Google)
  const { data, error } = await supaSSR.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Adjust scopes as needed for Gmail API
      scopes:
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly",
      // After Google redirects back, Supabase will handle session cookies
      // Set to your app URL/page that finalizes and stores tokens in gmail_tokens
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
    },
  });

  if (error || !data?.url) {
    return NextResponse.json(
      { error: error?.message || "Could not start Google OAuth" },
      { status: 500 }
    );
  }

  // Redirect the user to Google's consent screen
  return NextResponse.redirect(data.url);
}