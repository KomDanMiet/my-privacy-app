// app/results/page.js
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DsarButton from "@/components/DsarButton";
import DsarList from "@/components/DsarList";
import VerifyGate from "@/components/VerifyGate";

function Section({ title, hint, items = [], email, name }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        {title} <span style={{ opacity: 0.6, fontSize: 14 }}>({items.length})</span>
      </h3>
      {hint && <p style={{ opacity: 0.8, marginTop: 0, marginBottom: 10 }}>{hint}</p>}
      {items.length === 0 ? (
        <div style={{ opacity: 0.7 }}>—</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((c) => (
            <li key={c.domain} style={{
              border: "1px solid #444", borderRadius: 8, padding: 12,
              marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "monospace" }}>{c.domain}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {c.contact_type}
                  {typeof c.confidence === "number" ? ` • ${c.confidence}` : ""}
                  {c.value ? ` • ${c.value}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <DsarButton
                  email={email}
                  name={name}
                  company={{
                    name: c.domain,
                    domain: c.domain,
                    privacyUrl: c.contact_type === "form" ? c.value : undefined,
                    contactEmail: c.contact_type === "email" ? c.value : undefined,
                    contact_type: c.contact_type,
                    confidence: c.confidence,
                  }}
                  action="delete"
                >
                  DSAR versturen
                </DsarButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Results({ searchParams }) {
  const email = typeof searchParams?.email === "string" ? searchParams.email : "";
  const name  = typeof searchParams?.name  === "string" ? searchParams.name  : "";
  if (!email) redirect("/");

  // 1) envs
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[results] missing Supabase envs");
    return <main style={{ padding: 16 }}>❌ Server misconfiguratie (Supabase envs ontbreken).</main>;
  }

  // 2) verified?
  let verified = false;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await sb
      .from("subscribers").select("verified_at").eq("email", email).maybeSingle();
    if (error) throw error;
    verified = !!data?.verified_at;
  } catch (e) {
    console.error("[results] verify DB error:", e);
    return <main style={{ padding: 16 }}>❌ DB-fout bij verificatie. Probeer later opnieuw.</main>;
  }

  if (!verified) {
    return (
      <main style={{ padding: 16 }}>
        <h2>Verificatie vereist</h2>
        <p>Check je mailbox en klik op de verificatielink.</p>
        <VerifyGate email={email} name={name} />
      </main>
    );
  }

  // 3) fetch discover (met timeout)
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  let considered = 0, eligible = [], needsForm = [], review = [], none = [], err = null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    const resp = await fetch(`${base}/api/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, limit: 40, confidenceMin: 60 }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(t);
    const j = await resp.json();
    considered = j?.considered ?? 0;
    eligible   = j?.eligible   ?? [];
    needsForm  = j?.needsForm  ?? [];
    review     = j?.review     ?? [];
    none       = j?.none       ?? [];
  } catch (e) {
    console.error("[results] discover fetch error:", e);
    err = "discover fetch failed/timeout";
  }

  return (
    <main style={{ padding: 16 }}>
      <h2>📊 Bedrijven die (waarschijnlijk) jouw data hebben</h2>
      <p>Voor: <b>{email}</b>{name ? <> — {name}</> : null}</p>

      {err && <p style={{ color: "#f87171" }}>Kon resultaten niet volledig laden: {err}</p>}
      {considered === 0 && !err && (
        <p style={{ opacity: 0.8 }}>
          Geen bronnen gevonden in je database voor dit adres. Vul <code>discovered_senders</code> of verlaag drempel.
        </p>
      )}

      <Section title="Auto-email klaar" hint="Direct te mailen via DPO-adres." items={eligible}   email={email} name={name} />
      <Section title="Formulier nodig" hint="Gebruik het privacy/DSAR-portaal." items={needsForm} email={email} name={name} />
      <Section title="Twijfelgevallen (laag)" hint="Check even; kan alsnog verstuurd worden." items={review} email={email} name={name} />
      <Section title="Nog geen kanaal" hint="Handmatig toevoegen of later opnieuw." items={none} email={email} name={name} />

      <DsarList email={email} />
    </main>
  );
}