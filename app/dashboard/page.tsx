// app/dashboard/page.tsx
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function Dashboard() {
  const supabase = await getSupabaseServer(); // <-- await

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: meta } = await supabase
    .from("gmail_scan_meta")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: senders } = await supabase
    .from("discovered_senders")
    .select("domain,count,last_seen")
    .eq("user_id", user!.id)
    .order("last_seen", { ascending: false })
    .limit(20);

  return (
    // ... your JSX
  );
}
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DiscoDruif</h1>
          <p className="text-sm text-gray-500">Status: {scanning}</p>
          <p className="text-sm text-gray-500">Laatste scan: {lastScanAt}</p>
          <p className="text-sm text-gray-500">
            Unieke domeinen totaal: {totalUniqueDomains ?? 0}
          </p>
        </div>
        <form action="/api/gmail/scan" method="post">
          <button className="px-3 py-2 rounded-lg border hover:bg-gray-50">
            Scan opnieuw
          </button>
        </form>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Recent gedetecteerde domeinen</h2>
        <ul className="divide-y border rounded-lg">
          {(senders ?? []).map((s) => (
            <li key={`${s.domain}-${s.last_seen ?? ""}`} className="p-3 flex items-center justify-between">
              <span>{s.domain}</span>
              <span className="text-sm text-gray-500">
                {(s.count ?? 0).toString()} ·{" "}
                {s.last_seen ? new Date(s.last_seen).toLocaleDateString() : "—"}
              </span>
            </li>
          ))}
          {(!senders || senders.length === 0) && (
            <li className="p-3 text-sm text-gray-500">Nog geen resultaten.</li>
          )}
        </ul>
      </section>
    </main>
  );
}