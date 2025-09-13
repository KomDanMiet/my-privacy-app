// app/api/gmail/start/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = new URL("/auth/callback", site).toString();

  // In your environment cookies() is async and readonly
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        // Starting OAuth doesn’t need to *set* cookies here; no-ops satisfy the type.
        set: () => {},
        remove: () => {},
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes:
        "https://www.googleapis.com/auth/gmail.readonly openid email profile",
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