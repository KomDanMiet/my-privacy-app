// app/dashboard/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";

type ScanMeta = {
  user_id: string;
  scanned_at: string | null;
  last_count: number | null;
  last_unique_domains: number | null;
  last_error_code?: string | null;
};

type SenderRow = {
  domain: string;
  count: number | null;
  last_seen: string | null;
};

export default async function Dashboard() {
  const supabase = await getSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // TEMP cast until your generated types include this table
  const { data: metaRaw } = await (supabase as any)
    .from("gmail_scan_meta")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const meta = (metaRaw ?? null) as ScanMeta | null;

  const { data: senders = [] } = await supabase
    .from("discovered_senders")
    .select("domain,count,last_seen")
    .eq("user_id", user.id)
    .order("last_seen", { ascending: false })
    .limit(20)
    .returns<SenderRow[]>(); // avoids SelectQueryError union

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Last scan: {meta?.scanned_at ? new Date(meta.scanned_at).toLocaleString() : "—"}
          </p>
          <p className="text-sm text-gray-500">
            Emails scanned: {meta?.last_count ?? 0} · Unique domains: {meta?.last_unique_domains ?? 0}
          </p>
          {meta?.last_error_code && (
            <p className="text-sm text-red-600">Error: {meta.last_error_code}</p>
          )}
        </div>
        <form action="/api/gmail/scan" method="post">
          <button className="px-3 py-2 rounded-lg border hover:bg-gray-50">
            Scan again
          </button>
        </form>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Recently detected domains</h2>
        <ul className="divide-y border rounded-lg">
          {senders.map((s) => (
            <li key={`${s.domain}-${s.last_seen ?? ""}`} className="p-3 flex items-center justify-between">
              <span>{s.domain}</span>
              <span className="text-sm text-gray-500">
                {(s.count ?? 0).toString()} · {s.last_seen ? new Date(s.last_seen).toLocaleDateString() : "—"}
              </span>
            </li>
          ))}
          {senders.length === 0 && (
            <li className="p-3 text-sm text-gray-500">No results yet.</li>
          )}
        </ul>
      </section>
    </main>
  );
}