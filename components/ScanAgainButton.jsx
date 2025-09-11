"use client";
import { useState } from "react";

export default function ScanAgainButton({ email, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    try {
      setBusy(true);
      setMsg("Bezig met scannen…");
      const r = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, max: 800, days: 365 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setMsg(j?.error || "Scan mislukt.");
        setBusy(false);
        return;
      }
      setMsg(`Gescand: ${j.scanned} berichten • Domeinen: ${j.uniqueDomains}`);
      if (onDone) onDone(j);
      // small delay so user can read, then refresh
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg(String(e));
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={run}
        disabled={busy}
        style={{ padding: "8px 12px", borderRadius: 6, background: "#0ea5e9", color: "#fff" }}
      >
        {busy ? "Scannen…" : "Scan opnieuw"}
      </button>
      {msg && <span style={{ fontSize: 12, opacity: 0.8 }}>{msg}</span>}
    </div>
  );
}