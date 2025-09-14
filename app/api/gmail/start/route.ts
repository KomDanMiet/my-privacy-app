// app/api/gmail/start/route.ts
import { NextResponse } from "next/server";
import { getSupabaseInRoute } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const res = NextResponse.next();
  const supabase = await getSupabaseInRoute(res);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes:
        "openid email profile https://www.googleapis.com/auth/gmail.readonly",
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    return NextResponse.json(
      { error: error?.message || "Could not start Google OAuth" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.url);
}