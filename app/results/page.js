// app/results/page.js
import DsarButton from "@/components/DsarButton";

export default async function Results({ searchParams }) {
  const email = searchParams?.email || "";

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const resp = await fetch(`${base}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store", // geen caching
  });

  const data = await resp.json();
  const companies = data?.companies || [];

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>📊 Mogelijke bedrijven met jouw data</h2>
      <p>Voor: <b>{email}</b></p>

      {companies.length === 0 ? (
        <p>Geen bedrijven gevonden.</p>
      ) : (
        companies.map((c, i) => (
          <div key={i} style={{border:"1px solid #444", borderRadius:8, padding:14, marginBottom:12}}>
            <div style={{fontWeight:"bold"}}>{c.name}</div>
            <div style={{opacity:.8}}>{c.category || "—"}</div>
            <div style={{ marginTop: 8 }}>
  {c.privacyUrl && (
    <a href={c.privacyUrl} target="_blank" rel="noopener noreferrer">
      Privacy policy
    </a>
  )}

  <div style={{ marginTop: 6, display: "flex", gap: "8px" }}>
    <DsarButton email={email} company={c} action="delete">
      Verwijder mijn data
    </DsarButton>
    <DsarButton email={email} company={c} action="compensate">
      Vraag compensatie
    </DsarButton>
  </div>
</div>

          </div>
        ))
      )}
    </main>
  );
}
