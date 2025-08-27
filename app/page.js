"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");

      // ✅ redirect naar results met email in de URL
      router.push(`/results?email=${encodeURIComponent(email)}`);
      setEmail("");
      setStatus("success");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600 }}>
      <h1>🔒 My Privacy App</h1>
      <p>Welkom! Hier kun je straks zien welke bedrijven je data hebben.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", gap: 8 }}>
        <input
          type="email"
          required
          placeholder="jouw@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
        >
          {status === "loading" ? "Bezig..." : "Check mijn data"}
        </button>
      </form>

      {status === "error" && (
        <p style={{ marginTop: 12, color: "crimson" }}>❌ Er ging iets mis. Probeer opnieuw.</p>
      )}
    </main>
  );
}