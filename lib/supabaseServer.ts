// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export async function getSupabaseServer() {
  // Next 15: cookies() is async
  const store = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      // In Server Components we must NOT mutate cookies.
      // Let middleware refresh cookies; here we expose only read access.
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(_cookies) {
          // no-op in Server Components (mutations only allowed in Middleware/Route Handlers/Server Actions)
        },
      },
    }
  );
}