// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export async function getSupabaseServer() {
  const store = await cookies(); // Next 15

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        // hand the whole cookie jar to Supabase
        getAll: () => store.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, ...options }) => {
            store.set({ name, value, ...options });
          });
        },
      },
    }
  );
}