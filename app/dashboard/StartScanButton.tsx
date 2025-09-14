// app/dashboard/StartScanButton.tsx
"use client";

import { useState } from "react";

export default function StartScanButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `Scan failed (${res.status})`);
      }
      setMsg(
        `Scan complete. Unique domains: ${body?.unique_domains ?? "?"} (scanned ${body?.scanned_count ?? "?"} msgs)`
      );
    } catch (e: any) {
      setErr(e?.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={onClick}
        disabled={loading}
        style={{
          padding: "10px 16px",
          borderRadius: 6,
          background: "#22c55e",
          color: "white",
          border: "none",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Scanning…" : "Scan Gmail"}
      </button>
      {msg && <p style={{ color: "#065f46", marginTop: 8 }}>{msg}</p>}
      {err && <p style={{ color: "#b91c1c", marginTop: 8 }}>{err}</p>}
    </div>
  );
}