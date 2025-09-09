"use client";
import { useEffect, useState } from "react";

export default function AutoScanAndReload({ email }) {
  const [msg, setMsg] = useState("Bezig met scannen…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/discovery/gmail/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, days: 365, max: 1200 }),
          cache: "no-store",
        });
        if (!cancelled) setMsg("Bijna klaar… vernieuwen…");
        setTimeout(() => {
          if (!cancelled) location.reload();
        }, 1200);
      } catch {
        if (!cancelled) setMsg("Scan mislukt. Probeer opnieuw.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return <div style={{ marginTop: 8, opacity: 0.8 }}>{msg}</div>;
}