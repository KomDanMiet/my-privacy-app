// components/VerifyGate.jsx
"use client";
import { useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function VerifyGate({ email, name }) {
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const goResults = useCallback(() => {
    const params = new URLSearchParams(search?.toString() || "");
    params.set("email", email);
    if (name) params.set("name", name);
    const target = `/results?${params.toString()}`;

    if (pathname?.startsWith("/results")) {
      router.refresh();    // already on results: re-render
    } else {
      router.replace(target);
    }
  }, [email, name, pathname, router, search]);

  async function checkOnce() {
    const r = await fetch(`/api/verify/check?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    return !!(j?.ok && j?.verified);
  }

  async function handleClick() {
    setChecking(true);
    setMsg("Controleren…");
    const start = Date.now();
    const TIMEOUT = 20_000;

    while (Date.now() - start < TIMEOUT) {
      try {
        if (await checkOnce()) {
          setMsg("Geverifieerd! Even doorsturen…");
          goResults();
          return;
        }
      } catch {
        // ignore, retry
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    setMsg("Nog niet geverifieerd. Klik opnieuw nadat je de e-mail hebt bevestigd.");
    setChecking(false);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={handleClick} disabled={checking} style={{ padding: "8px 12px" }}>
        {checking ? "Controleren…" : "Ik heb geverifieerd"}
      </button>
      {msg && <div style={{ marginTop: 8, opacity: 0.8 }}>{msg}</div>}
    </div>
  );
}