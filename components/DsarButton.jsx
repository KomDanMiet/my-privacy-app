"use client";

import { useState } from "react";

export default function DsarButton({ email, company, action = "delete", children }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function send() {
    try {
      setLoading(true);
      setMsg("");
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Versturen mislukt");
      setMsg(`✅ Verzonden naar: ${data.sentTo}${data.mode === "preview" ? " (preview)" : ""}`);
    } catch (e) {
      setMsg(`❌ Fout: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={send} disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "Versturen..." : children}
      </button>
      {msg && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{msg}</div>}
    </div>
  );
}
