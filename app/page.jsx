// app/page.tsx
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function Home() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>DiscoDruif</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>
        Welcome! Log in to see which companies have your data and manage requests.
      </p>

      {!user ? (
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/login" style={{ padding: "10px 14px", borderRadius: 8, background: "#0ea5e9", color: "#fff", textDecoration: "none" }}>
            Log in
          </Link>
          <Link href="/privacy" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", textDecoration: "none" }}>
            Learn more
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard" style={{ padding: "10px 14px", borderRadius: 8, background: "#22c55e", color: "#111", textDecoration: "none" }}>
            Go to Dashboard
          </Link>
          <Link href="/settings" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", textDecoration: "none" }}>
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent" }}>
              Log out
            </button>
          </form>
        </div>
      )}
    </main>
  );
}