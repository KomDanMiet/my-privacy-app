import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabaseServer"; // werkt met de standaard Next alias "@"

/* Als je een import error krijgt op "@/lib/...", gebruik dan dit:
   import { getServerClient } from "../../../lib/supabaseServer";
*/

export async function POST(req) {
  try {
    const { email } = await req.json();

    // simpele e-mail check
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const supa = getServerClient();

    // insert; als email al bestaat (unique), negeren we die fout
    const { error } = await supa.from("subscribers").insert({ email });

    // Supabase geeft bij duplicate meestal code 23505
    if (error && error.code !== "23505") {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || "Server error" }, { status: 500 });
  }
}