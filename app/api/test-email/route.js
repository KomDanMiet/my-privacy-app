// app/api/test-email/route.js
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/test-email" });
}

export async function POST(req) {
  try {
    const { to } = await req.json();
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to'" }, { status: 400 });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "My Privacy App <onboarding@resend.dev>",
        to: [to],
        subject: "Testmail van My Privacy App",
        html: `<p>Dit is een testmail. Als je dit ziet werkt Resend 🎉</p>`,
      }),
    });

    const text = await resp.text();
    console.log("Resend status:", resp.status, "body:", text);

    if (!resp.ok) {
      return NextResponse.json({ ok: false, status: resp.status, body: text }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: resp.status, body: text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}