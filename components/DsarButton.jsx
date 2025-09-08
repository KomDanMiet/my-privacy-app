// app/components/DsarButton.jsx
"use client";
import { useState } from "react";

function toHost(v = "") {
  let d = String(v).trim().toLowerCase();
  d = d.replace(/^mailto:/, "");
  if (d.includes("@")) d = d.split("@")[1];
  d = d.replace(/^https?:\/\//, "").split("/")[0];
  d = d.replace(/^www\./, "");
  return d;
}

export default function DsarButton({ company, userEmail, userName, action = "delete" }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      const domain = toHost(company?.domain || company?.website || company?.url || "");
      const r = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          name: userName,
          company: { ...company, domain }, // normalized
          action,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        alert(j.error || "Kon verzoek niet opslaan");
        return;
      }
      if (j.channel === "form" && j.url) {
        window.open(j.url, "_blank", "noopener,noreferrer");
      } else if (j.channel === "email") {
        alert(`Verzonden naar ${j.to}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="px-3 py-2 rounded-md bg-black text-white disabled:opacity-50"
            onClick={onClick} disabled={loading}>
      {loading ? "Bezig..." : "Verwijder mijn data"}
    </button>
  );
}
