"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // client supabase (alleen voor auth handelingen op de client)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setMsg("Check je e-mail voor de inloglink.");
    } catch (err: any) {
      setMsg(err.message || "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg(error.message);
  };

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 24 }}>
      <h1>Inloggen</h1>
      <p>Log in met een magic link of Google.</p>

      <form onSubmit={sendMagicLink} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "10px 12px" }}
        />
        <button disabled={loading} type="submit">
          {loading ? "Bezig..." : "Stuur magic link"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <button onClick={signInGoogle}>Log in met Google</button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}