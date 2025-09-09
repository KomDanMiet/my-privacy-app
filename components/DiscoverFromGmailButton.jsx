"use client";
import { useState } from "react";

export default function DiscoverFromGmailButton({ userEmail }) {
  const [busy, setBusy] = useState(false);
  async function connect() {
    window.location.href = `/api/discovery/gmail/redirect?email=${encodeURIComponent(userEmail)}`;
  }
  async function scan() {
    try {
      setBusy(true);
      const r = await fetch(`/api/discovery/gmail/run?email=${encodeURIComponent(userEmail)}&days=365&max=200`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) { alert(j.error || "Scan failed"); return; }
      console.log(j);
      alert(`Gevonden: ${j.found} domeinen. Check console/logs.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={connect} className="px-3 py-2 rounded-md bg-black text-white">Koppel Gmail</button>
      <button onClick={scan} disabled={busy} className="px-3 py-2 rounded-md bg-gray-800 text-white disabled:opacity-50">
        {busy ? "Scannen..." : "Scan inbox"}
      </button>
    </div>
  );
}
