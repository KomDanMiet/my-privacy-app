// components/DsarButton.jsx
"use client";

import { useRef, useEffect, useState } from "react";

// kleine helper om events te loggen naar /api/dsar/event
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
  const [preview, setPreview] = useState(null);
  const detailsRef = useRef(null);

  // wanneer details open gaat en we hebben een id -> event loggen
  useEffect(() => {
    if (open && preview?.id) {
      track(preview.id, "preview_opened");
    }
  }, [open, preview?.id]);

  async function handleClick() {
    setLoading(true);
    try {
      const resp = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          company,
          action,
          mode: "preview", // we sturen nog NIET echt
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "Kon preview niet opslaan");
      }
      setPreview(data);
      setOpen(true);
      await track(data.id, "preview_created");
    } catch (e) {
      console.error(e);
      alert(`Kon preview niet opslaan: ${e.message}`);
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
        {loading
          ? "Bezig..."
          : action === "delete"
          ? "Verwijder mijn data"
          : "Vraag compensatie"}
      </button>

      {preview && (
        <details
          ref={detailsRef}
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
          style={{ marginTop: 8 }}
        >
          <summary>Bekijk wat er verstuurd zóu worden</summary>
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
            <div>
              <b>To:</b> {preview.to}
            </div>
            <div>
              <b>Subject:</b> {preview.subject}
            </div>
            <div style={{ marginTop: 8 }}>
              <b>Body:</b>
            </div>
            <pre style={{ whiteSpace: "pre-wrap" }}>{preview.body}</pre>
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              Preview opgeslagen (<i>status: {preview.status}</i>). Er is niets verstuurd.
            </div>
          </div>
        </details>
      )}
    </div>
  );
}