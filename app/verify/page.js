// app/verify/page.js
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // geen caching

export default async function Verify({ searchParams }) {
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY || // fallback
    process.env.SUPABASE_SECRET;        // fallback

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("ENV check", {
      hasUrl: !!SUPABASE_URL,
      hasService: !!SERVICE_KEY,
    });
    throw new Error("Supabase env vars missing");
  }

  if (!token) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        ❌ Ongeldige of ontbrekende verificatielink.
      </main>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1) Token ophalen
  const { data: row, error } = await supabase
    .from("verify_tokens")
    .select("email, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !row) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        ❌ Ongeldige of verlopen verificatielink.
      </main>
    );
  }

  if (new Date(row.expires_at) < new Date()) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        ❌ Verificatielink is verlopen.
      </main>
    );
  }

  // 2) Subscriber markeren als verified
  await supabase
    .from("subscribers")
    .update({ verified_at: new Date().toISOString() })
    .eq("email", row.email);

  // Naam ophalen om door te geven aan /results
  const { data: sub } = await supabase
    .from("subscribers")
    .select("full_name")
    .eq("email", row.email)
    .maybeSingle();

  // 3) Token opruimen
  await supabase.from("verify_tokens").delete().eq("token", token);

  const name = sub?.full_name || "";

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      ✅ Je e-mail is geverifieerd.<br /><br />
      <a
        href={`/results?email=${encodeURIComponent(row.email)}&name=${encodeURIComponent(name)}`}
        style={{
          display: "inline-block",
          padding: "10px 14px",
          background: "#0ea5e9",
          color: "#fff",
          borderRadius: 6,
          textDecoration: "none",
        }}
      >
        Ga naar mijn resultaten
      </a>
    </main>
  );
}