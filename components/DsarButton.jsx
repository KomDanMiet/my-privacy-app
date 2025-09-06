// components/DsarButton.jsx
"use client";

import { useRef, useEffect, useState } from "react";

async function track(dsarId, type, meta) {
  try {
    await fetch("/api/dsar/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dsar_id: dsarId, type, meta }),
    });
  } catch (e) {
    console.warn("track event failed", e);
  }
}

export default function DsarButton({ email, name, company, action }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const detailsRef = useRef(null);

  useEffect(() => {
    if (open && result?.id) track(result.id, "preview_opened");
  }, [open, result?.id]);

  async function handleClick() {
    setLoading(true);
    try {
      const resp = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, company, action }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "Kon verzoek niet opslaan");
      setResult(data);
      setOpen(true);
      await track(data.id, data.status === "sent" ? "sent" : "preview_created");
    } catch (e) {
      console.error(e);
      alert(`Kon verzoek niet opslaan: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #444",
          background: "#18181b",
          color: "#e5e7eb",
          cursor: "pointer",
        }}
      >
        {loading ? "Bezig..." : action === "delete" ? "Verwijder mijn data" : "Vraag compensatie"}
      </button>

      {result && (
        <details
          ref={detailsRef}
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
          style={{ marginTop: 8 }}
        >
          <summary>
            {result.status === "sent" ? "✅ Verstuurd — bekijk details" : "📄 Preview — bekijk details"}
          </summary>

          <div
            style={{
              marginTop: 8,
              border: "1px solid #333",
              borderRadius: 6,
              padding: 12,
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
            }}
          >
            <div><b>To:</b> {result.to}</div>
            {result.replyTo ? <div><b>Reply-To:</b> {result.replyTo}</div> : null}
            <div><b>Subject:</b> {result.subject}</div>
            <div style={{ marginTop: 8 }}><b>Body:</b></div>

            {/* 👉 Toon HTML als die er is, anders tekst */}
            {result.html ? (
              <div
                style={{ whiteSpace: "normal", fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial" }}
                dangerouslySetInnerHTML={{ __html: result.html }}
              />
            ) : (
              <pre style={{ whiteSpace: "pre-wrap" }}>{result.body || "(geen body)"}</pre>
            )}

            <div style={{ marginTop: 8, opacity: 0.8 }}>
              Status: <i>{result.status || "previewed"}</i> ({result.mode})
            </div>
          </div>
        </details>
      )}
    </div>
  );
}