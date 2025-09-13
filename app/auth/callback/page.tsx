"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState("Finishing sign-in…");

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    (async () => {
      try {
        // 1) OAuth / PKCE flow => ?code=...
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          router.replace("/dashboard");
          return;
        }

        // 2) Magic link (email) => #access_token=...&refresh_token=...
        const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
        const h = new URLSearchParams(hash);
        const access_token = h.get("access_token");
        const refresh_token = h.get("refresh_token");

        if (access_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token ?? undefined,
          });
          if (error) throw error;
          router.replace("/dashboard");
          return;
        }

        // 3) Newer email templates can use ?token_hash=...&type=magiclink
        const token_hash = search.get("token_hash");
        const type = (search.get("type") as "magiclink" | "recovery" | null) ?? null;
        if (token_hash && type === "magiclink") {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
          if (error) throw error;
          router.replace("/dashboard");
          return;
        }

        setMsg("No auth code or token in callback URL.");
      } catch (err: any) {
        setMsg(`Could not get session from magic link: ${err?.message ?? String(err)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <a href="/">Home</a> &nbsp; <a href="/auth/signin">Sign in</a>
      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}