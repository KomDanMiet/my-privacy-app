import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabaseServer";

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const supa = getServerClient();

    // Insert subscriber (ignore duplicates)
    const { error: insErr } = await supa.from("subscribers").insert({ email });
    if (insErr && insErr.code !== "23505") throw insErr;

    // Create token
    const { data: tok, error: tokErr } = await supa
      .from("verify_tokens")
      .insert({ email })
      .select("token")
      .single();
    if (tokErr) throw tokErr;

    // Verification link
    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
    const verifyUrl = `${base}/verify?token=${tok.token}`;

    // Send email via Resend
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "My Privacy App <noreply@myprivacyapp.dev>",
        to: [email],
        subject: "Bevestig je e-mail",
        html: `<p>Welkom bij <b>My Privacy App</b>!<br>
          Klik op <a href="${verifyUrl}">deze link</a> om je e-mail te bevestigen.<br>
          <small>Link verloopt in 30 minuten.</small></p>`
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}