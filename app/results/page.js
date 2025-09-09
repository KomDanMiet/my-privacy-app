// app/results/page.js
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// componenten
import DsarButton from "@/components/DsarButton";
import DsarList from "@/components/DsarList";
import VerifyGate from "@/components/VerifyGate";

function Section({ title, hint, items = [], badge }) {
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
            <li
              key={c.domain}
              style={{
                border: "1px solid #444",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "monospace" }}>{c.domain}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {c.contact_type} {typeof c.confidence === "number" ? `• ${c.confidence}` : ""}
                  {c.value ? ` • ${c.value}` : ""}
                </div>
              </div>

              {/* Acties – we geven een 'company' achtig object door voor bestaande DsarButton */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <DsarButton
                  email={Section.email}
                  name={Section.name}
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
  const name = typeof searchParams?.name === "string" ? searchParams.name : "";
  if (!email) redirect("/");

  // --- Supabase server client ---
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase envs");
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        ❌ Server misconfiguratie. Neem contact op met support.
      </main>
    );
  }

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
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Verificatie vereist</h2>
        <p>Je moet eerst je e-mail verifiëren voordat je toegang krijgt tot de resultaten.</p>
        <p>Check je mailbox en klik op de verificatielink.</p>
        <VerifyGate email={email} name={name} />
      </main>
    );
  }

  // 2) ✅ User is verified → gepersonaliseerde discovery ophalen (géén caching)
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const resp = await fetch(`${base}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, limit: 50, confidenceMin: 60 }),
    cache: "no-store",
  });

  const data = await resp.json().catch(() => ({}));
  const eligible = data?.eligible ?? [];
  const needsForm = data?.needsForm ?? [];
  const review = data?.review ?? [];
  const none = data?.none ?? [];

  // geef email/name door aan Section voor de DsarButton props
  Section.email = email;
  Section.name = name;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>📊 Bedrijven die (waarschijnlijk) jouw data hebben</h2>
      <p>
        Voor: <b>{email}</b>
        {name ? <> — {name}</> : null}
      </p>

      <Section
        title="Auto-email klaar"
        hint="Direct te mailen via DPO-adres."
        items={eligible}
        badge="eligible"
      />
      <Section
        title="Vereist handmatig formulier"
        hint="Deze partijen gebruiken een privacy-/DSAR-portaal."
        items={needsForm}
        badge="form"
      />
      <Section
        title="Twijfelgevallen (lage confidence)"
        hint="Check even het contact; je kunt alsnog versturen."
        items={review}
        badge="review"
      />
      <Section
        title="Geen contact gevonden (nog)"
        hint="We hebben nog geen kanaal; voeg handmatig toe of probeer later opnieuw."
        items={none}
        badge="none"
      />

      {/* Overzicht van verzonden verzoeken */}
      <DsarList email={email} />
    </main>
  );
}