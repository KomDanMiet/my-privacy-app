"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [checking, setChecking] = useState(false);

  // Prefill vanuit localStorage als je terugkomt
  useEffect(() => {
    const saved = localStorage.getItem("pendingUser");
    if (saved) {
      try {
        const { name, email } = JSON.parse(saved);
        if (name) setName(name);
        if (email) setEmail(email);
      } catch {}
    }
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!name || !email) {
      setMsg("Vul je naam en e-mail in.");
      return;
    }

    setLoading(true);
    try {
      // Sla alvast op zodat je het niet terug hoeft te typen
      localStorage.setItem("pendingUser", JSON.stringify({ name, email }));

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Kon niet inschrijven");
      }

      // Verify-mail is verstuurd → toon modal
      setShowVerifyModal(true);

      // (Optioneel) start polling om elke 5s te checken
      startPolling();
    } catch (err) {
      setMsg(`Er ging iets mis: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function startPolling() {
    const interval = setInterval(async () => {
      const ok = await checkVerified(false);
      if (ok) clearInterval(interval);
    }, 5000);
  }

  /** Check of verified; als verified -> redirect naar /results */
  async function checkVerified(showToast = true) {
    try {
      setChecking(true);
      const url = `/api/verify/check?email=${encodeURIComponent(email)}`;
      const r = await fetch(url);
      const j = await r.json();

      if (j?.ok && j?.verified) {
        const finalName = j?.name || name || "";
        // netjes opruimen
        localStorage.removeItem("pendingUser");
        // door naar resultaten zonder opnieuw invullen
        router.push(`/results?email=${encodeURIComponent(email)}&name=${encodeURIComponent(finalName)}`);
        return true;
      }
      if (showToast) setMsg("Nog niet geverifieerd. Probeer het over een moment opnieuw.");
      return false;
    } catch (e) {
      if (showToast) setMsg(`Check mislukt: ${e.message}`);
      return false;
    } finally {
      setChecking(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 520 }}>
      <h1>My Privacy App</h1>
      <p>Welkom! Hier kun je straks zien welke bedrijven je data hebben.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          type="text"
          placeholder="Je naam"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#eee" }}
        />
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#eee" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 12px", borderRadius: 6, background: "#0ea5e9", color: "white", border: "none" }}
        >
          {loading ? "Bezig..." : "Check mijn data"}
        </button>
      </form>

      {msg && (
        <div style={{ marginTop: 10, color: msg.startsWith("Er ging") ? "#f87171" : "#a3e635" }}>
          {msg}
        </div>
      )}

      <p style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
        Door verder te gaan bevestig je dat je de eigenaar bent van dit e-mailadres.
      </p>

      {/* Modal */}
      {showVerifyModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "#111", border: "1px solid #333", padding: 20, borderRadius: 8, width: 420 }}>
            <h3>Verifieer je e-mail</h3>
            <p>
              We hebben een verificatielink naar <b>{email}</b> gestuurd.<br />
              Klik op de link in je e-mail. Daarna kun je hieronder op <i>“Ik heb geverifieerd”</i> drukken.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a
                href="https://mail.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "8px 10px", borderRadius: 6, background: "#22c55e", color: "#111", textDecoration: "none" }}
              >
                Open Gmail
              </a>
              <button
                onClick={() => checkVerified(true)}
                disabled={checking}
                style={{ padding: "8px 10px", borderRadius: 6, background: "#0ea5e9", color: "#fff", border: "none" }}
              >
                {checking ? "Controleren..." : "Ik heb geverifieerd"}
              </button>
              <button
                onClick={() => setShowVerifyModal(false)}
                style={{ padding: "8px 10px", borderRadius: 6, background: "#333", color: "#eee", border: "1px solid #444" }}
              >
                Sluiten
              </button>
            </div>
            <p style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>
              Tip: Controleer ook je spamfolder.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}