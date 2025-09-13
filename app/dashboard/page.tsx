"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch("/api/gmail/status"); // <-- you must implement this API
        const data = await res.json();
        setGmailConnected(data.connected);
      } catch (err) {
        setGmailConnected(false);
      }
    }
    checkConnection();
  }, []);

  if (gmailConnected === null) {
    return <p style={{ padding: 24 }}>Loading...</p>;
  }

  if (!gmailConnected) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Dashboard</h1>
        <p>To start scanning, please connect your Gmail account first.</p>
        <Link
          href="/api/gmail/start"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 6,
            background: "#0ea5e9",
            color: "white",
            textDecoration: "none",
            marginTop: 12,
          }}
        >
          Connect Gmail
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <p>✅ Gmail is connected. You can now scan for companies!</p>
      <button
        onClick={async () => {
          await fetch("/api/gmail/scan");
          alert("Scanning started...");
        }}
        style={{
          padding: "10px 16px",
          borderRadius: 6,
          background: "#22c55e",
          color: "white",
          border: "none",
          marginTop: 12,
        }}
      >
        Scan Gmail
      </button>
    </main>
  );
}