"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Gebruik de huidige origin in de browser; val server-side terug op env of localhost.
const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: SITE_URL + "/auth/callback?next=/" }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign in</h1>
      <button onClick={signInWithGoogle} disabled={loading}>
        {loading ? "Redirecting..." : "Continue with Google"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p style={{ marginTop: 12 }}>
        Debug: <a href="/auth/debug" target="_blank">/auth/debug</a>
      </p>
    </main>
  );
}
