import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// If you have generated DB types, you can add: createServerClient<Database>(...)
export async function getSupabaseServer() {
  const cookieStore = await cookies(); // <-- Next 15 is async

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      // The type here is a bit picky across versions; async wrappers are fine.
      cookies: {
        get: async (name: string) => cookieStore.get(name)?.value,
        set: async (name: string, value: string, options: any) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: async (name: string, options: any) => {
          cookieStore.set({ name, value: "", ...options });
        },
      } as any, // relax typing to avoid version mismatch noise
    }
  );
}