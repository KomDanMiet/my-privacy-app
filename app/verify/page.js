import { getServerClient } from "@/lib/supabaseServer";
import Link from "next/link";

export default async function Verify({ searchParams }) {
  const token = searchParams?.token;
  const supa = getServerClient();
  let msg = "❌ Ongeldige of verlopen verificatielink.";

  if (token) {
    const { data, error } = await supa
      .from("verify_tokens")
      .select("email, expires_at")
      .eq("token", token)
      .single();

    if (!error && data && new Date(data.expires_at) > new Date()) {
      // Markeer subscriber als verified
      await supa
        .from("subscribers")
        .update({ verified_at: new Date().toISOString() })
        .eq("email", data.email);

      // Token opruimen
      await supa.from("verify_tokens").delete().eq("token", token);

      msg = "✅ Je e-mail is succesvol bevestigd!";
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Verificatie</h1>
      <p>{msg}</p>
      <p><Link href="/">Ga terug naar home</Link></p>
    </main>
  );
}