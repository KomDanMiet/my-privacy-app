// app/api/gmail/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSupabaseInRoute } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient<Database>(SUPABASE_URL, SERVICE_KEY);

export async function GET() {
  const res = NextResponse.json({ connected: false });
  const supaSSR = await getSupabaseInRoute(res);

  const {
    data: { user },
  } = await supaSSR.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  // Check if gmail_tokens exists for this user
  const { data, error } = await sb
    .from("gmail_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ connected: false }, { status: 500 });
  }

  return NextResponse.json({ connected: !!data });
}