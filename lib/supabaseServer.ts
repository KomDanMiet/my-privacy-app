// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Read-only Supabase client for Server Components (RSC).
 * - Next 15: cookies() is async.
 * - Must NOT mutate cookies here.
 */
export async function getSupabaseServer() {
  const store = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        // No mutations allowed in Server Components
        setAll(_cookies) {},
      },
    }
  );
}

/**
 * Supabase client for Server Actions.
 * - Mutations to cookies are allowed; write via next/headers cookies() store.
 */
export async function getSupabaseInAction() {
  const store = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            store.set(name, value, normalizeCookieOptions(options));
          });
        },
      },
    }
  );
}

/**
 * Supabase client for Route Handlers.
 * - Pass the NextResponse you intend to return so refreshed tokens are set on it.
 */
export async function getSupabaseInRoute(res: NextResponse) {
  const store = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, normalizeCookieOptions(options));
          });
        },
      },
    }
  );
}

/** Optional: normalize options to what NextResponse.cookies.set expects */
function normalizeCookieOptions(options?: CookieOptions): Parameters<NextResponse["cookies"]["set"]>[2] {
  if (!options) return undefined;
  const { domain, expires, httpOnly, maxAge, path, sameSite, secure } = options;
  return { domain, expires, httpOnly, maxAge, path, sameSite, secure };
}