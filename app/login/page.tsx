// app/login/page.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const err = sp.get("error");

  // If someone lands here with ?code=, forward to the server callback
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
        <Link href="/login">Try again</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/" style={{ marginRight: 12 }}>
          Home
        </Link>
        <Link href="/login">Sign in</Link>
      </nav>
      <p>Finishing sign-in…</p>
    </main>
  );
}