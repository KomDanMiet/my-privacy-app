"use client";
import { useState } from "react";

export default function DsarButton({ email, name, company, action, children }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState("");

  async function handleClick() {
    setLoading(true);
    setMsg("");
    setPreview(null);
    try {
      const r = await fetch("/api/dsar?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, company, email, name }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed");
      setPreview(j);
      setMsg("Preview opgeslagen (status: previewed). Er is niets verstuurd.");
    } catch (e) {
      setMsg("Mislukt: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#eee" }}
      >
        {loading ? "Bezig..." : children}
      </button>

      {msg && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{msg}</div>}

      {preview && (
        <details style={{ marginTop: 8 }}>
          <summary>Bekijk wat er verstuurd zóu worden</summary>
          <div style={{ marginTop: 8, padding: 10, border: "1px solid #333", borderRadius: 6 }}>
            <div><b>To:</b> {preview.to}</div>
            <div><b>Subject:</b> {preview.subject}</div>
            <div style={{ marginTop: 8 }}>
              <b>Body:</b>
              <div
                style={{ marginTop: 6, background: "#0b0b0b", padding: 10, borderRadius: 6 }}
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}