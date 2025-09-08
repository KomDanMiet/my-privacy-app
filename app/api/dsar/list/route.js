// app/api/dsar/list/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ ok:false, error:"Missing email" }, { status:400 });

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET;

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await db
    .from("dsar_requests")
    .select("id, created_at, company_name, company_domain, action, status, to, subject")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  }

  return NextResponse.json({ ok:true, items: data || [] });
}