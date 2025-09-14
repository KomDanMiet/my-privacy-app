// app/dashboard/page.tsx
import { getSupabaseServer } from "@/lib/supabaseServer";
import StartScanButton from "./StartScanButton";

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "—";

  // Check if Gmail connected by looking at identities and/or tokens table via API
  // For simplicity, call the status API server-side (no-store)
  const statusRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/status`, {
    cache: "no-store",
    // Pass cookies (App Router does this automatically server-side)
  }).catch(() => null);

  const statusJson = statusRes && statusRes.ok ? await statusRes.json() : { connected: false };
  const connected = Boolean(statusJson.connected);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 720, margin: "40px auto" }}>
      <h1>Dashboard</h1>
      <p>
        Ingelogd als <strong>{email}</strong>
      </p>

      {connected ? (
        <>
          <p>✅ Gmail is verbonden. Je kunt nu scannen op bedrijven.</p>
          <StartScanButton />
        </>
      ) : (
        <>
          <p>Gmail is nog niet verbonden.</p>
          <a
            href="/api/gmail/start"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 6,
              background: "#2563eb",
              color: "white",
              textDecoration: "none",
              marginRight: 12,
            }}
          >
            Connect Gmail
          </a>
          <p style={{ marginTop: 8, color: "#666" }}>
            (Na het verbinden kun je de scan starten.)
          </p>
        </>
      )}
    </main>
  );
}