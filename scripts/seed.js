// scripts/seed.js  (ESM)
const BASE =
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

const domains = [
  "bol.com","coolblue.nl","ah.nl","jumbo.com","ns.nl","ing.nl","rabobank.nl",
  "abnamro.nl","t-mobile.nl","vodafone.nl","ziggo.nl","kpn.com",
  "marktplaats.nl","booking.com","uber.com","airbnb.com","spotify.com",
  "google.com","facebook.com","instagram.com","linkedin.com","microsoft.com","apple.com"
];

async function seedOne(d) {
  const url = `${BASE}/api/contact/lookup?domain=${encodeURIComponent(d)}&force=1`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    const ct = j?.contact?.contact_type ?? "-";
    const val = j?.contact?.value ?? "";
    console.log(d.padEnd(18), r.status, String(ct).padEnd(6), val);
  } catch (e) {
    console.log(d.padEnd(18), "ERR", e?.message ?? e);
  }
}

for (const d of domains) await seedOne(d);
