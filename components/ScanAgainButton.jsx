// components/ScanAgainButton.jsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanAgainButton({ email }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, max: 50, days: 1000 }),
      });
      // Give the server a moment to write, then refresh the page data
      setTimeout(() => router.refresh(), 800);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        background: busy ? "#6b7280" : "#0ea5e9",
        color: "#fff",
        border: 0,
        borderRadius: 6,
        padding: "8px 12px",
        cursor: busy ? "not-allowed" : "pointer",
      }}
    >
      {busy ? "Scannen…" : "Scan opnieuw"}
    </button>
  );
}