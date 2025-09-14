// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";

function baseUrl() {
  // Prefer explicit prod URL; fall back to Vercel env; then localhost for dev
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchCompanies() {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const res = await fetch(`${baseUrl()}/api/companies`, {
    // forward auth cookies so /api/companies can see the session
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items as { domain: string; last_seen: string; source: string; email: string }[];
}

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const items = await fetchCompanies();

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>Dashboard</h1>
      <p>Ingelogd als <strong>{user?.email ?? "—"}</strong></p>

      <form action="/api/gmail/scan" method="POST" style={{ margin: "16px 0" }}>
        <button type="submit" style={{ padding: "10px 16px", borderRadius: 6, background: "#22c55e", color: "#fff", border: 0 }}>
          Scan Gmail
        </button>
      </form>

      <h2>Companies found</h2>
      {items.length === 0 ? (
        <p>Nog geen resultaten. Klik hierboven op <em>Scan Gmail</em> om te starten.</p>
      ) : (
        <ul>
          {items.map((r) => (
            <li key={`${r.domain}-${r.last_seen}`}>
              {r.domain} — {new Date(r.last_seen).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}