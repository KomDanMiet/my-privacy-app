// app/api/is-verified/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: "Supabase env vars missing" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: row, error } = await supabase
      .from("subscribers")
      .select("verified_at, full_name")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("is-verified error", error);
      return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
    }

    const verified = !!row?.verified_at;
    return NextResponse.json({
      ok: true,
      verified,
      name: row?.full_name || "",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}