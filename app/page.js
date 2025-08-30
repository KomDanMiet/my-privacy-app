// app/results/page.js
export const dynamic = "force-dynamic"; // SSR

function dsarMailto(company, email, type = "delete") {
  const to = `privacy@${company.domain || "example.com"}`;
  const subject =
    type === "delete"
      ? "Verzoek tot verwijdering van persoonsgegevens (AVG/GDPR)"
      : "Verzoek tot inzage/compensatie persoonsgegevens";
  const body = [
    `Beste ${company.name || "Privacy Team"},`,
    "",
    "Ik doe een beroep op mijn rechten onder de AVG (GDPR).",
    type === "delete"
      ? "Ik verzoek u al mijn persoonsgegevens te verwijderen en dit schriftelijk te bevestigen."
      : "Ik verzoek inzage in alle persoonsgegevens die u over mij verwerkt en eventuele grondslag/compensatie indien van toepassing.",
    "",
    `E-mailadres: ${email}`,
    "Bewaartermijnen en verwerkingsdoelen graag specificeren.",
    "",
    "Met vriendelijke groet,",
    "",
    "(Je naam)",
  ].join("\n");

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function Results({ searchParams }) {
  const email = typeof searchParams?.email === "string" ? searchParams.email : "";
  if (!email) {
    return <main style={{ padding: "2rem" }}><h2>Geen e-mail opgegeven</h2></main>;
  }

  // Server-side call to our discover API
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const resp = await fetch(`${base}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    // revalidate: 0 to always fresh
    cache: "no-store"
  });

  const data = await resp.json().catch(() => ({}));
  const companies = data?.companies || [];

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Waarschijnlijke bedrijven met jouw data</h1>
      <p><strong>{email}</strong></p>

      {!companies.length && <p>Geen bedrijven gevonden. Probeer later opnieuw.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "12px", marginTop: "1rem" }}>
        {companies.map((c, idx) => (
          <div key={idx} style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: "bold" }}>{c.name}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{c.domain} • {c.category} • source: {c.source}</div>
            {c.privacyUrl && (
              <div style={{ marginTop: 6 }}>
                <a href={c.privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <a href={dsarMailto(c, email, "delete")} style={{ padding: "6px 10px", border: "1px solid #888", borderRadius: 6, textDecoration: "none" }}>
                Verwijder mijn data
              </a>
              <a href={dsarMailto(c, email, "comp")} style={{ padding: "6px 10px", border: "1px solid #888", borderRadius: 6, textDecoration: "none" }}>
                Vraag compensatie
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
