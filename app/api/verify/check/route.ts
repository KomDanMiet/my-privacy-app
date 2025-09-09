// app/api/verify/check/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: Request) {
  try {
    const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
    if (!email) return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });

    const sb = createClient(SUPABASE_URL, KEY);
    const { data, error } = await sb
      .from("subscribers")
      .select("verified_at")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ ok: true, verified: !!data?.verified_at });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "err" }, { status: 500 });
  }
}