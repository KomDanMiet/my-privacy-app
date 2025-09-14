// app/api/companies/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSupabaseInRoute } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// service role for server-only data access
const sb = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const res = NextResponse.json({ ok: true });
  const supaSSR = await getSupabaseInRoute(res);

  const { data: { user } } = await supaSSR.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await sb
    .from("discovered_senders")
    .select("domain,last_seen,source,email")
    .eq("user_id", user.id)
    .order("last_seen", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}