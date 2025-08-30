// app/api/subscribe/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function htmlEmail({ verifyUrl }) {
  return `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Verify your email</h2>
      <p>Click the button below to verify your email address.</p>
      <p>
        <a href="${verifyUrl}" 
           style="display:inline-block;padding:10px 14px;background:#111;color:#fff;
                  border-radius:6px;text-decoration:none">
          Verify email
        </a>
      </p>
      <p style="font-size:12px;opacity:.8">
        If you did not request this, you can ignore this email.
      </p>
    </div>
  `;
}

export async function POST(req) {
  try {
    const { email, name } = await req.json();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ correcte var
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: "Supabase env vars missing" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1) Upsert subscriber met full_name
    const { error: upErr } = await supabase
      .from("subscribers")
      .upsert({ email, full_name: name ?? null }, { onConflict: "email" });

    if (upErr) {
      console.error("Insert subscribers error:", upErr);
      // niet blokkeren; we proberen wel door te gaan met verify
    }

    // 2) Token aanmaken (verloopt in 30m: zie jouw DDL)
    const { data: tokenRow, error: tokErr } = await supabase
      .from("verify_tokens")
      .insert({ email })
      .select("*")
      .single();

    if (tokErr || !tokenRow?.token) {
      console.error("Create token error:", tokErr);
      return NextResponse.json({ ok: false, error: "Could not create verify token" }, { status: 500 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${base}/verify?token=${encodeURIComponent(tokenRow.token)}`;

    // 3) Mail sturen via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM = process.env.RESEND_FROM || "no-reply@example.com";

    const payload = {
      from: FROM, // bij geverifieerd domein: bv. no-reply@jouwdomein.com
      to: [email],
      subject: "Verify your email",
      html: htmlEmail({ verifyUrl }),
    };

    let sent = null;
    let mode = "live";

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (r.status === 403) {
        // fallback naar preview modus (Resend policy)
        mode = "preview";
        const pr = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "x-resend-ignore-verification": "true",
          },
          body: JSON.stringify(payload),
        });
        const t = await pr.text().catch(() => "");
        if (!pr.ok) throw new Error(`Resend preview failed (${pr.status}): ${t}`);
        sent = await pr.json().catch(() => ({}));
      } else {
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`Resend failed (${r.status}): ${t}`);
        sent = JSON.parse(t);
      }
    } catch (e) {
      console.error("Resend error:", e);
      return NextResponse.json({ ok: false, error: "Email send failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode,
      verifyUrl, // handig voor debug
      to: email,
      sentId: sent?.id ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}