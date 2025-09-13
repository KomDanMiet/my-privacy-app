import { getSupabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="nl">
      <body>
        <header style={{ display: "flex", gap: 12, padding: 12 }}>
          <Link href="/">Home</Link>
          {user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/settings">Settings</Link>
            </>
          ) : (
            <Link href="/login">Inloggen</Link>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}