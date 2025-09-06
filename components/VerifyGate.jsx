// app/components/VerifyGate.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyGate({ email, name }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function checkAgain() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`/api/is-verified?email=${encodeURIComponent(email)}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok && j.verified) {
        // direct naar resultaten, naam meegooien
        const q = new URLSearchParams({ email, ...(name ? { name } : {}) }).toString();
        router.replace(`/results?${q}`);
      } else {
        setMsg("Nog niet geverifieerd. Check je mailbox en klik op de verificatielink.");
      }
    } catch (e) {
      setMsg("Kon verificatiestatus niet ophalen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={checkAgain}
        disabled={loading}
        style={{ padding: "8px 12px", borderRadius: 6, background: "#0ea5e9", color: "#fff", border: "none" }}
      >
        {loading ? "Bezig..." : "Ik heb geverifieerd – check opnieuw"}
      </button>
      {msg && <div style={{ marginTop: 8, color: "#f87171" }}>{msg}</div>}
    </div>
  );
}