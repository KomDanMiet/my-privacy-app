// ✅ Server component (geen "use client"; geen hooks nodig)
const DUMMY_VENDORS = [
  { name: "Google", policy: "https://policies.google.com/privacy" },
  { name: "Meta (Facebook)", policy: "https://www.facebook.com/privacy/policy" },
  { name: "TikTok", policy: "https://www.tiktok.com/legal/page/row/privacy-policy/en" },
  { name: "Criteo", policy: "https://www.criteo.com/privacy/" },
  { name: "Quantcast", policy: "https://www.quantcast.com/privacy/" },
];

export default function Results({ searchParams }) {
  const email = searchParams?.email ?? null;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 760 }}>
      <h1>🔎 Mogelijke bedrijven met jouw data</h1>
      {email && <p style={{ opacity: 0.8 }}>Voor: <strong>{email}</strong></p>}

      <p style={{ marginTop: 8 }}>
        Dit is een eerste indicatieve lijst. In de volgende stap kun je <b>verwijderverzoeken</b> sturen
        of later kiezen voor <b>compensatie</b>.
      </p>

      <ul style={{ marginTop: 16, padding: 0, listStyle: "none" }}>
        {DUMMY_VENDORS.map((v) => (
          <li key={v.name} style={{
            border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <strong>{v.name}</strong><br/>
              <a href={v.policy} target="_blank" rel="noreferrer">Privacy policy</a>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnOutline}>Verwijder mijn data</button>
              <button style={btnPrimary}>Ik wil betaald worden</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer"
};
const btnOutline = {
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer"
};