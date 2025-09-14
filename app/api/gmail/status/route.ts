// app/api/gmail/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Next 15: cookies() is async
    const jar = await cookies();

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getCookie: (name: string) => jar.get(name)?.value ?? null,
          setCookie: (name: string, value: string, options?: any) =>
            jar.set({ name, value, ...(options ?? {}) }),
          deleteCookie: (name: string, options?: any) =>
            jar.set({ name, value: "", ...(options ?? {}) }),
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { connected: false, reason: "not_signed_in" },
        { status: 200 }
      );
    }

    // If your Database type doesn't include gmail_tokens yet, cast to any
    const { data: tok, error } = (supabase as any)
      .from("gmail_tokens")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { connected: false, reason: "db_error" },
        { status: 200 }
      );
    }

    const connected = !!tok;
    return NextResponse.json(
      { connected, email: tok?.email ?? null },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { connected: false, reason: "unknown" },
      { status: 200 }
    );
  }
}