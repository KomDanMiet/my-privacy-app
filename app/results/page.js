// app/results/page.js
import DsarButton from "@/components/DsarButton";
import { redirect } from "next/navigation";

export default async function Results({ searchParams }) {
  const email = typeof searchParams?.email === "string" ? searchParams.email : "";
  const name  = typeof searchParams?.name  === "string" ? searchParams.name  : "";

  if (!email) {
    // Geen e-mail → terug naar home
    redirect("/");
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const resp = await fetch(`${base}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });

  const data = await resp.json();
  const companies = data?.companies || [];

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>📊 Mogelijke bedrijven met jouw data</h2>
      <p>
        Voor: <b>{email}</b>
        {name ? <> — {name}</> : null}
      </p>

      {companies.length === 0 ? (
        <p>Geen bedrijven gevonden.</p>
      ) : (
        companies.map((c, i) => (
          <div key={i} style={{ border: "1px solid #444", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: "bold" }}>{c.name}</div>
            <div style={{ opacity: 0.8 }}>{c.category || "—"}</div>

            <div style={{ marginTop: 8 }}>
              {c.privacyUrl && (
                <a href={c.privacyUrl} target="_blank" rel="noopener noreferrer">
                  Privacy policy
                </a>
              )}

              <div style={{ marginTop: 6, display: "flex", gap: "8px" }}>
                <DsarButton email={email} name={name} company={c} action="delete">
                  Verwijder mijn data
                </DsarButton>
                <DsarButton email={email} name={name} company={c} action="compensate">
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