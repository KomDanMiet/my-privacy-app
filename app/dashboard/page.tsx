"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gmail/status", { cache: "no-store" });
        const data = await res.json();
        setGmailConnected(!!data.connected);
      } catch {
        setGmailConnected(false);
      }
    })();
  }, []);

  if (gmailConnected === null) return <p style={{ padding: 24 }}>Loading…</p>;

  if (!gmailConnected) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Dashboard</h1>
        <p>To start scanning, please connect your Gmail account first.</p>
        <Link
          href="/api/gmail/start"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 6,
            background: "#0ea5e9",
            color: "white",
            textDecoration: "none",
            marginTop: 12,
          }}
        >
          Connect Gmail
        </Link>
      </main>
    );
  }

  const runScan = async () => {
    try {
      setBusy(true);
      const res = await fetch("/api/gmail/scan", { method: "POST" }); // <-- POST!
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Scan failed");
        return;
      }
      alert(`Scan complete. Unique domains: ${j.unique_domains ?? "?"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <p>✅ Gmail is connected. You can now scan for companies.</p>
      <button
        onClick={runScan}
        disabled={busy}
        style={{
          padding: "10px 16px",
          borderRadius: 6,
          background: "#22c55e",
          color: "white",
          border: "none",
          marginTop: 12,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Scanning…" : "Scan Gmail"}
      </button>
    </main>
  );
}