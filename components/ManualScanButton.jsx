// components/ManualScanButton.jsx
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
        body: JSON.stringify({ email, force: true }),
      });
      const j = await resp.json().catch(() => ({}));
      if (resp.ok && j?.ok) {
        setMsg("✅ Scan voltooid!");
        router.refresh();
      } else {
        setMsg(j?.error || "❌ Scan mislukt.");
      }
    } catch (e) {
      setMsg("❌ Er is iets misgegaan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}
      className="px-3 py-2 rounded-md bg-sky-600 text-white disabled:opacity-50">
      {loading ? "Scannen…" : "🔄 Scan opnieuw"}
    </button>
  );
}

