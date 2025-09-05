import { useRef, useEffect, useState } from "react";

async function track(dsarId, type, meta) {
  try {
    await fetch("/api/dsar/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dsar_id: dsarId, type, meta }),
    });
  } catch (_) {}
}

export default function DsarButton({ email, name, company, action }) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reqId, setReqId] = useState(null);
  const [preview, setPreview] = useState(null);
  const detailsRef = useRef(null);

  // Als de gebruiker het "details" blok opent, log event
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const handler = () => {
      if (el.open && reqId) {
        track(reqId, "preview_opened", {
          company: company?.domain || company?.name,
          action,
        });
      }
    };
    el.addEventListener("toggle", handler);
    return () => el.removeEventListener("toggle", handler);
  }, [reqId, action, company]);

  async function onClick() {
    setLoading(true);
    try {
      const r = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, company, action, mode: "preview" }),
      });
      const data = await r.json();

      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Kon preview niet opslaan");
      }

      setPreview({ to: data.to, subject: data.subject, body: data.body });
      setSaved(true);
      setReqId(data.id);

      // ⬇️ log event: preview aangemaakt
      track(data.id, "preview_created", {
        company: company?.domain || company?.name,
        action,
      });
    } catch (e) {
      alert(`Er ging iets mis: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button disabled={loading} onClick={onClick}>
        {action === "delete" ? "Verwijder mijn data" : "Vraag compensatie"}
      </button>

      {saved && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          Preview opgeslagen (status: <b>previewed</b>). Er is niets verstuurd.
        </div>
      )}

      {preview && (
        <details ref={detailsRef} style={{ marginTop: 8 }}>
          <summary>Bekijk wat er verstuurd zóu worden</summary>
          <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", marginTop: 8 }}>
            <b>To:</b> {preview.to}
            {"\n"}
            <b>Subject:</b> {preview.subject}
            {"\n\n"}
            <b>Body:</b>
            {"\n"}
            {preview.body}
          </div>
        </details>
      )}
    </div>
  );
}