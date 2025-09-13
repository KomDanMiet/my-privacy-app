// app/auth/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export default function AuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Finishing sign-in...");

  useEffect(() => {
    const run = async () => {
      const errDesc = params.get("error_description");
      if (errDesc) {
        setStatus(errDesc); // e.g. "Email link is invalid or has expired"
        return;
      }

      const code = params.get("code");
      if (!code) {
        setStatus("No auth code in callback URL.");
        return;
      }

      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setStatus(error.message);
        return;
      }

      // success
      router.replace("/dashboard");
    };
    run();
  }, [params, router]);

  return <p>{status}</p>;
}