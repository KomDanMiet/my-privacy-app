// app/gmail/page.tsx (server)
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export default async function GmailResults() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return <div>Log in om je resultaten te zien.</div>;

  const [{ data: meta }, { data: senders }] = await Promise.all([
    sb.from("gmail_scan_meta").select("*").eq("user_id", user.id).maybeSingle(),
    sb.from("discovered_senders").select("domain,last_seen_at").eq("user_id", user.id).order("last_seen_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gmail resultaten</h1>
        <form action="/api/gmail/scan" method="post">
          <input type="hidden" name="userId" value={user.id} />
          <button className="px-3 py-1.5 rounded-md border">Scan opnieuw</button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Laatst gescand" value={meta?.scanned_at ? new Date(meta.scanned_at).toLocaleString() : "–"} />
        <Stat label="E-mails gescand" value={meta?.last_count ?? 0} />
        <Stat label="Nieuwe domeinen" value={meta?.last_unique_domains ?? 0} />
      </div>

      <div>
        <h2 className="font-medium mb-2">Voorbeeld domeinen</h2>
        <ul className="space-y-1">
          {(senders ?? []).map((s) => (
            <li key={s.domain} className="text-sm flex items-center justify-between border-b py-1">
              <span>{s.domain}</span>
              <span className="text-xs opacity-70">{new Date(s.last_seen_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <Link href="/senders" className="text-sm underline">Alles bekijken</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs uppercase opacity-60">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
function ErrorBanner({ message, needsReconnect }: { message: string; needsReconnect?: boolean }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 flex items-center justify-between">
      <span>{message}</span>
      {needsReconnect && <a href="/api/auth/google/reconnect" className="px-3 py-1.5 rounded-md border">Gmail opnieuw verbinden</a>}
    </div>
  );
}
