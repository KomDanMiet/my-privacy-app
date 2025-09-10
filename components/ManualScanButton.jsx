"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ManualScanButton({ email }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setMsg("Bezig met scannen…");
    try {
      const resp = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await resp.json().catch(() => ({}));

      if (resp.ok && j?.ok) {
        setMsg("✅ Scan voltooid! Vernieuwen…");
        // re-run the server component fetches (fast, no full reload)
        router.refresh();
      } else {
        setMsg(j?.error || "❌ Scan mislukt. Probeer later opnieuw.");
      }
    } catch (e) {
      console.error("[scan] error", e);
      setMsg("❌ Er is iets misgegaan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          background: "#0ea5e9",
          color: "#fff",
          cursor: "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Scannen…" : "🔄 Scan opnieuw"}
      </button>
      {msg && <span style={{ opacity: 0.85, fontSize: 13 }}>{msg}</span>}
    </div>
  );
}
