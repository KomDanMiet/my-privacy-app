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

      const hash = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash);

      // helper: start scan but don't crash if it fails
      const startScan = async () => {
        try {
          await fetch("/api/gmail/scan", { method: "POST" });
        } catch {
          /* ignore — maybe Gmail not connected yet */
        }
      };

      // New-style magic link: #code=...
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          setMsg("Could not get session from magic link.");
          return;
        }
        await startScan();
        window.location.replace("/dashboard");
        return;
      }

      // Fallback: #access_token=...&refresh_token=...
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          console.error(error);
          setMsg("Could not get session from magic link.");
          return;
        }
        await startScan();
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