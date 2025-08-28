// app/api/discover/route.js
import { NextResponse } from "next/server";
import vendors from "./data/vendors.json"; // <— RELATIVE import, werkt direct


/**
 * Optional HIBP lookup (paid API). Set env: HIBP_API_KEY
 * Docs: https://haveibeenpwned.com/API/v3#BreachesForAccount
 */
async function hibpLookup(email) {
  const key = process.env.HIBP_API_KEY;
  if (!key) return [];
  try {
    const resp = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": key,
          "user-agent": "my-privacy-app/1.0 (contact@example.com)"
        },
        // HIBP advises rate limits; no cache
      }
    );
    if (resp.status === 404) return []; // no breaches
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.warn("HIBP error", resp.status, t);
      return [];
    }
    const breaches = await resp.json();
    return (breaches || []).map(b => ({
      name: b.Name,
      domain: b.Domain || b.Name,
      category: "Breach Evidence",
      privacyUrl: b.Domain ? `https://${b.Domain}` : undefined,
      source: "hibp",
      evidence: { breachDate: b.BreachDate, dataClasses: b.DataClasses }
    }));
  } catch (e) {
    console.warn("HIBP fetch failed", e);
    return [];
  }
}

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    // 1) Always include curated vendors as "likely"
    const likely = vendors.map(v => ({ ...v, source: "catalog" }));

    // 2) Optional HIBP enrichment
    const hibp = await hibpLookup(email);

    // 3) Merge & dedupe by domain/name
    const map = new Map();
    [...hibp, ...likely].forEach(c => {
      const key = (c.domain || c.name).toLowerCase();
      if (!map.has(key)) map.set(key, c);
    });

    return NextResponse.json({
      ok: true,
      email,
      companies: Array.from(map.values())
    });
  } catch (e) {
    console.error("discover error", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
