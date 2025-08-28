import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabaseServer";

// ... bovenin blijven je imports etc.

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    // ... jouw Supabase insert + token code hier ...

    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://my-privacy-app.vercel.app";
    const verifyUrl = `${base}/verify?token=${tok.token}`;

    // ✅ MAIL
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "My Privacy App <onboarding@resend.dev>",
        to: [email],                           // ← alleen jouw eigen mail werkt in test-mode
        subject: "Bevestig je e-mail",
        html: `<p>Klik om te bevestigen: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
      }),
    });

    const text = await resp.text();
    console.log("RESEND ok?", resp.ok, "status:", resp.status, "body:", text);

    // TIJDELIJK: laat dit terugkomen zodat je het in Network → Response ziet
    return NextResponse.json({ ok: resp.ok, resendStatus: resp.status, resendBody: text });
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 });
  }
}
