export const dynamic = "force-dynamic";

import ScanAgainButton from "@/components/ScanAgainButton";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DsarButton from "@/components/DsarButton";
import DsarList from "@/components/DsarList";
import VerifyGate from "@/components/VerifyGate";
import AutoScanAndReload from "@/components/AutoScanAndReload";
function Section({ title, hint, items = [], email, name }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        {title}{" "}
        <span style={{ opacity: 0.6, fontSize: 14 }}>({items.length})</span>
      </h3>
      {hint && <p style={{ opacity: 0.8, margin: "0 0 10px" }}>{hint}</p>}

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
                    contactEmail:
                      c.contact_type === "email" ? c.value : undefined,
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

function isGmail(addr = "") {
  return addr.toLowerCase().endsWith("@gmail.com");
}

export default async function Results({ searchParams }) {
  const email = typeof searchParams?.email === "string" ? searchParams.email : "";
  const name = typeof searchParams?.name === "string" ? searchParams.name : "";
  if (!email) redirect("/");

  // --- envs ---
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[results] missing Supabase envs");
    return <main style={{ padding: 16 }}>❌ Server misconfiguratie.</main>;
  }

  // --- verified? ---
  let verified = false;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await sb
      .from("subscribers")
      .select("verified_at")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    verified = !!data?.verified_at;
  } catch (e) {
    console.error("[results] verify DB error:", e);
    return (
      <main style={{ padding: 16 }}>
        ❌ DB-fout bij verificatie. Probeer later opnieuw.
      </main>
    );
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

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";

  // --- Gmail token status ---
  let gmailStatus = { hasToken: false, isFresh: false, scannedAt: null };
  if (isGmail(email)) {
    try {
      const s = await fetch(
        `${base}/api/gmail/status?email=${encodeURIComponent(email)}`,
        { cache: "no-store" }
      );
      const sj = await s.json().catch(() => ({}));
      gmailStatus = {
        hasToken: (sj?.hasToken ?? sj?.connected) ? true : false,
        isFresh: !!sj?.isFresh,
        scannedAt: sj?.scannedAt ?? null,
      };
    } catch {
      gmailStatus = { hasToken: false, isFresh: false, scannedAt: null};
    }
  }

  // --- discover buckets ---
  let considered = 0,
    eligible = [],
    needsForm = [],
    review = [],
    none = [],
    err = null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30_000);
    const resp = await fetch(`${base}/api/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, limit: 80, confidenceMin: 60 }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(t);
    const j = await resp.json();
    considered = j?.considered ?? 0;
    eligible = j?.eligible ?? [];
    needsForm = j?.needsForm ?? [];
    review = j?.review ?? [];
    none = j?.none ?? [];
  } catch (e) {
    console.error("[results] discover fetch error:", e);
    err = "discover fetch failed/timeout";
  }

  const hasAny =
    (eligible.length || 0) +
      (needsForm.length || 0) +
      (review.length || 0) +
      (none.length || 0) >
    0;

  return (
    <main style={{ padding: 16 }}>
      <h2>📊 Bedrijven die jouw data hebben</h2>
      <p>
        Voor: <b>{email}</b>
        {name ? <> — {name}</> : null}
      </p>
{/* Controls (exactly one shows at a time) */}
{isGmail(email) && (
  <>
    {/* 1) Connect CTA */}
    {!gmailStatus.hasToken && !gmailStatus.scannedAt && (
      <div style={{ margin: "12px 0", padding: 12, border: "1px dashed #555", borderRadius: 8 }}>
        <div style={{ marginBottom: 8 }}>
          <b>Eenmalige machtiging nodig</b><br/>
          We lezen alléén afzender-adressen om bedrijven te herkennen (geen inhoud).
        </div>
        <a
          href={`/api/gmail/start?email=${encodeURIComponent(email)}`}
          style={{ padding: "8px 12px", borderRadius: 6, background: "#0ea5e9", color: "#fff", textDecoration: "none" }}
        >
          Koppel Gmail en ontdek bedrijven
        </a>
      </div>
    )}

    {/* 2) Auto scan when token exists but we have no results yet */}
    {gmailStatus.hasToken && !hasAny && !gmailStatus.scannedAt && (
      <div style={{ marginTop: 12 }}>
        <div>Geen resultaten gevonden… We starten nu een scan…</div>
        <AutoScanAndReload email={email} />
      </div>
    )}

    {/* 3) Manual scan when we already have some results */}
    {gmailStatus.hasToken && hasAny && (
      <div style={{ margin: "12px 0 16px" }}>
        <ScanAgainButton email={email} />
        {gmailStatus.scannedAt && (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            Laatste scan: {new Date(gmailStatus.scannedAt).toLocaleString()}
          </div>
        )}
      </div>
    )}
  </>
)}
      {err && (
        <p style={{ color: "#f87171" }}>
          Kon resultaten niet volledig laden: {err}
        </p>
      )}

      <Section
        title="Auto-email klaar"
        hint="Direct te mailen via DPO-adres."
        items={eligible}
        email={email}
        name={name}
      />
      <Section
        title="Formulier nodig"
        hint="Gebruik het privacy/DSAR-portaal."
        items={needsForm}
        email={email}
        name={name}
      />
      <Section
        title="Twijfelgevallen (laag)"
        hint="Check even; kan alsnog verstuurd worden."
        items={review}
        email={email}
        name={name}
      />
      <Section
        title="Nog geen kanaal"
        hint="Handmatig toevoegen of later opnieuw."
        items={none}
        email={email}
        name={name}
      />

      <DsarList email={email} />
    </main>
  );
}