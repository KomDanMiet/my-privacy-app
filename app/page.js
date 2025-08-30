// app/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (!email || !name) {
      setMsg("Vul je naam en e-mail in.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Kon niet inschrijven");
      }

      // ✅ Door naar resultaten; naam gaat mee zodat die in DSAR-mails komt
      router.push(
        `/results?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
      );
    } catch (err) {
      setMsg(`Er ging iets mis: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 520 }}>
      <h1>My Privacy App</h1>
      <p>Welkom! Hier kun je straks zien welke bedrijven je data hebben.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          type="text"
          placeholder="Je naam"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#eee" }}
        />
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#eee" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 12px", borderRadius: 6, background: "#0ea5e9", color: "white", border: "none" }}
        >
          {loading ? "Bezig..." : "Check mijn data"}
        </button>
      </form>

      {msg && (
        <div style={{ marginTop: 10, color: msg.startsWith("Er ging") ? "#f87171" : "#a3e635" }}>
          {msg}
        </div>
      )}

      <p style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
        Door verder te gaan bevestig je dat je de eigenaar bent van dit e-mailadres.
      </p>
    </main>
  );
}