// app/components/DsarButton.jsx
"use client";

import { useState } from "react";

function toHost(v = "") {
  let d = String(v).trim().toLowerCase();
  d = d.replace(/^mailto:/, "");
  if (d.includes("@")) d = d.split("@")[1];         // e-mail -> domein
  d = d.replace(/^https?:\/\//, "").split("/")[0];  // URL -> host
  d = d.replace(/^www\./, "");
  return d;
}

/**
 * Props:
 *  - company: { domain?: string, website?: string, url?: string, name?: string }
 *  - userEmail: string
 *  - userName?: string
 *  - action: 'delete' | 'compensate'
 */
export default function DsarButton({ company, userEmail, userName, action = "delete" }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function onClick() {
    try {
      setLoading(true);
      setResult(null);

      const domain = toHost(
        company?.domain || company?.website || company?.url || company?.host || ""
      );
      if (!domain || !domain.includes(".")) {
        alert("Ongeldig domein");
        return;
      }

      // -> jouw proxy /api/dsar (die weer /api/dsar/send aanroept)
      const r = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          name: userName,
          company: { ...company, domain }, // normalized!
          action,
        }),
      });

      const j = await r.json();
      if (!r.ok || !j.ok) {
        alert(j.error || "Kon verzoek niet opslaan");
        console.error("DSAR error:", j);
        return;
      }

      setResult(j);
      if (j.channel === "form" && j.url) {
        // toon het officiële formulier
        window.open(j.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-2 rounded-md bg-black text-white disabled:opacity-50"
    >
      {loading ? "Bezig..." : "Verwijder mijn data"}
    </button>
  );
}
