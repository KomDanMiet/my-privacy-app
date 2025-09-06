"use client";
import { useEffect, useState } from "react";

export default function DsarList({ email }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const r = await fetch(`/api/dsar/list?email=${encodeURIComponent(email)}`);
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed");
        setItems(j.items || []);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [email]);

  if (!email) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <h3>📬 Mijn verzoeken</h3>
      {err && <div style={{ color: "#f87171" }}>{err}</div>}
      {items.length === 0 ? (
        <div>Nog geen verzoeken gelogd.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: "1px solid #333", borderRadius: 6, padding: 10 }}>
              <div style={{ fontWeight: 600 }}>
                {it.company_name} {it.company_domain ? `(${it.company_domain})` : ""}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {new Date(it.created_at).toLocaleString()} • Action: {it.action} • Status: <b>{it.status}</b>
              </div>
              <div style={{ fontSize: 12 }}>To: {it.to_address}</div>
              <div style={{ fontSize: 12 }}>Subject: {it.subject}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}