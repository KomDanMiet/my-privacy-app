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

    // ... after you create verifyUrl and have `email`
const resp = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "My Privacy App <onboarding@resend.dev>", // keep this in test mode
    to: [email], // in test mode, must be your own address
    subject: "Bevestig je e-mail",
    html: `<p>Klik om te bevestigen: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
  }),
});

const text = await resp.text();
console.log("RESEND ok?", resp.ok, "status:", resp.status, "body:", text);
return NextResponse.json({ ok: resp.ok, resendStatus: resp.status, resendBody: text });
