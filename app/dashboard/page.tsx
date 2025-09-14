// app/dashboard/page.tsx
import { getSupabaseServer } from "@/lib/supabaseServer";

async function fetchCompanies(baseUrl: string, cookie?: string) {
  const r = await fetch(`${baseUrl}/api/companies`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.items as { domain: string; last_seen: string; source: string; email: string }[];
}

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // fetch list server-side (no flash of empty state)
  const items = await fetchCompanies(base);

  const connected = !!user; // you can also check gmail_tokens via /api/gmail/status like earlier

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <p>Ingelogd als <strong>{user?.email ?? "—"}</strong></p>

      <div style={{ margin: "16px 0" }}>
        <form action="/api/gmail/scan" method="POST">
          <button
            type="submit"
            disabled={!connected}
            style={{ padding: "10px 16px", borderRadius: 6, background: "#22c55e", color: "#fff", border: 0 }}
          >
            Scan Gmail
          </button>
        </form>
      </div>

      <h2>Companies found</h2>
      {items.length === 0 ? (
        <p>Nog geen resultaten. Klik hierboven op <em>Scan Gmail</em> om te starten.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: 8 }}>Domain</th>
              <th style={{ padding: 8 }}>Last seen</th>
              <th style={{ padding: 8 }}>Source</th>
              <th style={{ padding: 8 }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={`${r.domain}-${r.last_seen}`} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{r.domain}</td>
                <td style={{ padding: 8 }}>{new Date(r.last_seen).toLocaleString()}</td>
                <td style={{ padding: 8 }}>{r.source}</td>
                <td style={{ padding: 8 }}>{r.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}