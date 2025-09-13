// app/auth/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing sign-in...");

  useEffect(() => {
    const run = async () => {
      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Supabase will automatically pick up #access_token and save session cookies
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setStatus(error?.message || "Could not get session from magic link");
        return;
      }

      // success
      setStatus("Signed in!");
      router.replace("/dashboard");
    };

    run();
  }, [router]);

  return <p>{status}</p>;
}