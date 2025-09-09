"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyGate({ email, name }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function checkOnce() {
    setChecking(true);
    setError(null);
    try {
      const r = await fetch(`/api/verify/check?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && j?.verified) {
        router.refresh(); // je Results server component haalt dan opnieuw de DB
        return true;
      }
    } catch (e) {
      setError("Kon verificatie niet checken.");
    } finally {
      setChecking(false);
    }
    return false;
  }

  async function poll() {
    const start = Date.now();
    const TIMEOUT = 20_000;
    while (Date.now() - start < TIMEOUT) {
      const ok = await checkOnce();
      if (ok) return;
      await new Promise(r => setTimeout(r, 2000));
    }
    setError("Nog niet geverifieerd. Probeer 'Ik heb geverifieerd' opnieuw.");
  }

  return (
    <div>
      {/* bestaande UI */}
      <button onClick={poll} disabled={checking}>
        {checking ? "Controleren..." : "Ik heb geverifieerd"}
      </button>
      {error && <div style={{ color: "#f66" }}>{error}</div>}
    </div>
  );
}