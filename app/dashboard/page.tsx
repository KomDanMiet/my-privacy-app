// app/dashboard/page.tsx (top of file)
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";

// inside component:
const supabase = await getSupabaseServer();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/auth/login");
export default async function Dashboard() {
  // 🔑 hier await gebruiken
  const supabase = await getSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Niet ingelogd</p>;
  }

  const { data: meta } = await supabase
    .from("gmail_scan_meta")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: senders } = await supabase
    .from("discovered_senders")
    .select("domain,count,last_seen")
    .eq("user_id", user.id)
    .order("last_seen", { ascending: false })
    .limit(20);

  return (
    <main>
      <h1>Dashboard</h1>
      <pre>{JSON.stringify(meta, null, 2)}</pre>
      <pre>{JSON.stringify(senders, null, 2)}</pre>
    </main>
  );
}