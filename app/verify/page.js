// app/verify/page.js
import { createClient } from "@supabase/supabase-js";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Verify({ searchParams }) {
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET;

  if (!SUPABASE_URL || !SERVICE_KEY) {
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
  const { data: row } = await supabase
    .from("verify_tokens")
    .select("email, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) {
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

  // 2) Naam ophalen (optioneel) en subscriber markeren als verified
  const { data: sub } = await supabase
    .from("subscribers")
    .select("full_name")
    .eq("email", row.email)
    .maybeSingle();

  await supabase
    .from("subscribers")
    .update({ verified_at: new Date().toISOString() })
    .eq("email", row.email);

  // 3) Token opruimen
  await supabase.from("verify_tokens").delete().eq("token", token);

  // 4) ✅ Session cookie zetten (zodat je ingelogd bent)
  await createSession({ email: row.email, name: sub?.full_name || null });

  // 5) Terug naar resultaten (met nette auto-redirect)
  const redirectTo = `/results?email=${encodeURIComponent(row.email)}${
    sub?.full_name ? `&name=${encodeURIComponent(sub.full_name)}` : ""
  }`;

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      ✅ Je e-mail is geverifieerd. Je wordt doorgestuurd…
      <meta httpEquiv="refresh" content={`1; url=${redirectTo}`} />
    </main>
  );
}
// ...bovenste deel blijft zoals je nu hebt

// 2) Subscriber markeren als verified
await supabase
  .from('subscribers')
  .update({ verified_at: new Date().toISOString() })
  .eq('email', row.email);

// Haal de naam op om ‘m door te geven aan /results
const { data: sub } = await supabase
  .from('subscribers')
  .select('full_name')
  .eq('email', row.email)
  .maybeSingle();

// 3) Token opruimen
await supabase.from('verify_tokens').delete().eq('token', token);

const name = sub?.full_name || "";

return (
  <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
    ✅ Je e-mail is geverifieerd.<br /><br />
    <a
      href={`/results?email=${encodeURIComponent(row.email)}&name=${encodeURIComponent(name)}`}
      style={{ display:"inline-block", padding:"10px 14px", background:"#0ea5e9", color:"#fff",
               borderRadius:6, textDecoration:"none" }}
    >
      Ga naar mijn resultaten
    </a>
  </main>
);