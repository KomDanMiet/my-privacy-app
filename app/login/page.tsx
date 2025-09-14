// app/login/page.tsx
// A lean page that handles magic-link fallback and shows status.
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const err = sp.get("error");

  // If someone still lands here with a ?code= (e.g., old redirect),
  // forward them to /auth/callback so the server can exchange cookies.
  useEffect(() => {
    const code = sp.get("code");
    if (code) {
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, [sp, router]);

  if (err) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Sign in</h1>
        <p style={{ color: "#b91c1c" }}>Error: {err}</p>
        <a href="/login">Try again</a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <nav style={{ marginBottom: 16 }}>
        <a href="/" style={{ marginRight: 12 }}>Home</a>
        <a href="/login">Sign in</a>
      </nav>
      <p>Finishing sign-in…</p>
    </main>
  );
}