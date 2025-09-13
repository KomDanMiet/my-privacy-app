// app/auth/page.tsx (client component)
"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Sending magic link...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // This MUST match your allow-listed redirect URL
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    setMsg(error ? error.message : "Check your email for the magic link!");
  }

  return (
    <form onSubmit={sendMagicLink}>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <button type="submit">Send magic link</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}