// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 👇 pass the full URL string (has ?code=...):
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      router.replace(error ? "/login?error=1" : "/dashboard");
    };

    run();
  }, [router]);

  return <p style={{ padding: 24 }}>Bezig met inloggen…</p>;
}