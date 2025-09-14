// app/api/gmail/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Next 15: cookies() is async
  const jar = await cookies();

  // Bind Supabase to request cookies
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (list) => {
          // Needed so Supabase can refresh the session cookie if it’s stale
          list.forEach(({ name, value, ...options }) => {
            jar.set({ name, value, ...(options as any) });
          });
        },
      },
    }
  );

  // 1) Who is signed in?
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { connected: false, email: null, reason: "not_authenticated" },
      { status: 401 }
    );
  }

  // 2) Check if a gmail_tokens row exists for this user
  const { data: row, error } = await supabase
    .from("gmail_tokens")
    .select("email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    // If your RLS policy on gmail_tokens is too strict, you'll hit this path.
    // Loosen RLS to: SELECT where user_id = auth.uid()
    return NextResponse.json(
      { connected: false, email: null, reason: "select_failed" },
      { status: 200 }
    );
  }

  return NextResponse.json({
    connected: !!row?.email,
    email: row?.email ?? null,
    reason: row?.email ? "ok" : "not_connected",
  });
}