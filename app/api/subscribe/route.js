// app/api/subscribe/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { email } = body;

    console.log("📩 Ontvangen email:", email);

    if (!email) {
      console.warn("⚠️ Geen email ontvangen!");
      return NextResponse.json({ ok: false, error: "Email is verplicht" }, { status: 400 });
    }

    // 1. Opslaan in Supabase
    const { error: dbError } = await supabase
      .from("subscribers")
      .insert({ email });

    if (dbError) {
      console.error("❌ Supabase fout:", dbError);
      return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
    }

    console.log("✅ Email opgeslagen in Supabase");

    // 2. Verstuur verificatiemail
    const resp = await resend.emails.send({
      from: "maurits.vaneck01@gmail.com",
      to: email,
      subject: "Verifieer je email",
      text: "Klik op deze link om je email te verifiëren: https://my-privacy-app.vercel.app/verify?token=test-token"
    });

    console.log("📨 Resend antwoord:", resp);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("🔥 Subscribe route error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Server error" },
      { status: 500 }
    );
  }
}
