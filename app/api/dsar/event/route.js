// app/api/dsar/event/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const { dsar_id, type, meta } = await req.json();

    if (!dsar_id || !type) {
      return NextResponse.json({ ok: false, error: "Missing dsar_id or type" }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, error: "Supabase env missing" }, { status: 500 });
    }

    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("dsar_events")
      .insert({ dsar_id, type, meta: meta ?? {} })
      .select("id, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id, at: data.created_at });
  } catch (e) {
    console.error("dsar/event error", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}