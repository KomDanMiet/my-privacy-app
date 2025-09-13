// app/settings/page.tsx
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Settings</h1>
        <p>You’re not signed in. <Link href="/auth/signin">Sign in</Link></p>
      </main>
    );
  }

  const { data: tok } = await supabase
    .from("gmail_tokens")
    .select("email")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main style={{ padding: 24 }}>
      <h1>Settings</h1>
      <section style={{ marginTop: 16 }}>
        <h2>Gmail</h2>
        {tok?.email ? (
          <p>Connected as <b>{tok.email}</b></p>
        ) : (
          <form action="/api/gmail/start" method="get">
            <button className="px-3 py-2 rounded border">Connect Gmail</button>
          </form>
        )}
      </section>
    </main>
  );
}