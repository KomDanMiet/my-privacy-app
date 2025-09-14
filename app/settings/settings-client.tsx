"use client";

import { useState } from "react";

const GOOGLE_PERMS_URL = "https://myaccount.google.com/permissions";

export default function SettingsClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(null);
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    setStatus(null);
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setStatus({ kind: "err", msg: "Enter a valid email address." });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Could not disconnect Gmail.");
      setStatus({ kind: "ok", msg: "Gmail disconnected. (Local tokens cleared.)" });
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message || "Failed to disconnect." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-zinc-800 p-5">
        <h2 className="text-xl font-semibold mb-2">Gmail connection</h2>
        <p className="text-sm opacity-80 mb-4">
          We only request <code>gmail.readonly</code> to analyze sender domains.
          You can revoke access anytime.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="text-sm opacity-80">Your email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <button
            onClick={disconnect}
            disabled={loading}
            className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Disconnecting..." : "Disconnect Gmail"}
          </button>

          <a
            href={GOOGLE_PERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-700 px-4 py-2"
          >
            Open Google permissions
          </a>
        </div>

        {status && (
          <div
            className={`mt-3 text-sm ${
              status.kind === "ok" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {status.msg}
          </div>
        )}
      </div>
    </section>
  );
}