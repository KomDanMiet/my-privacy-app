// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

// Middleware always runs on the Edge runtime
export const config = {
  // run on everything except static assets; include /api if you want auth cookies there too
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  // Prepare a response we can mutate cookies on
  const res = NextResponse.next();

  // Bind Supabase to req/res cookies
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // set on the response so the browser receives updates
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Touch auth so Supabase can refresh session cookies if needed
  // (ignore result; this just ensures cookies stay fresh)
  await supabase.auth.getUser().catch(() => {});

  return res;
}