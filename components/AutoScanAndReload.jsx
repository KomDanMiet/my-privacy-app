"use client";
import { useEffect, useRef } from "react";

export default function AutoScanAndReload({ email }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    (async () => {
      try {
        await fetch("/api/gmail/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch (e) {
        console.error("Auto scan error:", e);
      } finally {
        setTimeout(() => window.location.reload(), 1500);
      }
    })();
  }, [email]);

  return null;
}
