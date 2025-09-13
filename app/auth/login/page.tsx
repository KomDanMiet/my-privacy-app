"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const signInWithGoogle = async () => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg(error.message);
    setBusy(false);
  };

  const signInWithMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg(error.message);
    else setMsg("Check je mail voor de login link.");
    setBusy(false);
  };

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 24 }}>
      <h1>Inloggen</h1>
      <p style={{ opacity: .8, marginBottom: 16 }}>
        Log in om je dashboard te zien en je data-scans te starten.
      </p>

      <button
        onClick={signInWithGoogle}
        disabled={busy}
        style={{ width: "100%", padding: 12, borderRadius: 8, marginBottom: 12 }}
      >
        Log in met Google
      </button>

      <div style={{ opacity: .6, textAlign: "center", margin: "8px 0" }}>of</div>

      <form onSubmit={signInWithMagicLink} style={{ display: "grid", gap: 10 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#eee" }}
        />
        <button type="submit" disabled={busy} style={{ padding: 12, borderRadius: 8 }}>
          Stuur magic link
        </button>
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 24 }}>
        <button onClick={() => router.push("/")} style={{ opacity: .8 }}>← Terug naar home</button>
      </div>
    </main>
  );
}