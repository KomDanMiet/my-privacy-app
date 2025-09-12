import { getSupabaseServer } from "@/lib/supabaseServer";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString(); } catch { return "—"; }
}

export default async function Dashboard() {
  const supabase = await getSupabaseServer(); // <-- await

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">DiscoDruif</h1>
        <p className="text-gray-600 mt-2">Je bent niet ingelogd.</p>
      </main>
    );
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
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DiscoDruif</h1>
          <p className="text-sm text-gray-500">Laatste scan: {fmt(meta?.scanned_at)}</p>
          <p className="text-sm text-gray-500">
            Emails gescand: {meta?.last_count ?? 0} · Unieke domeinen: {meta?.last_unique_domains ?? 0}
          </p>
          {meta?.last_error_code && (
            <p className="text-sm text-red-600">Fout: {meta.last_error_code}</p>
          )}
        </div>
        <form action="/api/gmail/scan" method="post">
          <button className="px-3 py-2 rounded-lg border">Scan opnieuw</button>
        </form>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Recent gedetecteerde domeinen</h2>
        <ul className="divide-y border rounded-lg">
          {(senders ?? []).map((s) => (
            <li key={s.domain} className="p-3 flex items-center justify-between">
              <span>{s.domain}</span>
              <span className="text-sm text-gray-500">
                {(s as any).count ?? 0} · {fmt((s as any).last_seen)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}