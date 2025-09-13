"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    const run = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Magic link can arrive as `#code=...` (latest) or `#access_token=...`
      const hash = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash);

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          setMsg("Could not get session from magic link.");
          return;
        }
        window.location.replace("/dashboard");
        return;
      }

      // Fallback for older links
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          console.error(error);
          setMsg("Could not get session from magic link.");
          return;
        }
        window.location.replace("/dashboard");
        return;
      }

      setMsg("No auth code in callback URL.");
    };

    run();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <nav style={{ marginBottom: 12, display: "flex", gap: 12 }}>
        <Link href="/">Home</Link>
        <Link href="/auth/signin">Sign in</Link>
      </nav>
      <p>{msg}</p>
    </main>
  );
}