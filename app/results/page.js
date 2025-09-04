// app/results/page.js
import DsarButton from "@/components/DsarButton";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default async function Results({ searchParams }) {
  const email = typeof searchParams?.email === "string" ? searchParams.email : "";
  const name  = typeof searchParams?.name  === "string" ? searchParams.name  : "";

  if (!email) redirect("/");

  // 🔑 Supabase server client
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1) Check of subscriber bestaat & verified is
  const { data: sub, error } = await supabase
    .from("subscribers")
    .select("verified_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error);
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        ❌ Er ging iets mis. Probeer het later opnieuw.
      </main>
    );
  }

  if (!sub || !sub.verified_at) {
    // ❌ User nog niet verified
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        ❌ Je moet eerst je e-mail verifiëren voordat je toegang krijgt.  
        <p>Check je mailbox en klik op de verificatielink.</p>
      </main>
    );
  }

  // 2) ✅ User is verified → bedrijvenlijst ophalen
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