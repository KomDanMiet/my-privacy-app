// app/api/subscribe/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  rlIpMinute, rlIpDay, rlEmailDay, isBanned, rateLimitResponse,
} from "@/lib/ratelimit";

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
  </div>`;
}

export async function POST(req) {
  try {
    const { email, name, honeypot } = await req.json();

    // Honeypot (bots)
    if (honeypot) return rateLimitResponse({ reason: "honeypot" });

    // Validatie
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Ban/abuse
    if (await isBanned(ip) || await isBanned(email.toLowerCase())) {
      return rateLimitResponse({ reason: "banned" });
    }

    // Rate limits
    const r1 = await rlIpMinute.limit(ip);
    if (!r1.success) return rateLimitResponse({ scope: "ip_minute", reset: r1.reset });

    const r2 = await rlIpDay.limit(ip);
    if (!r2.success) return rateLimitResponse({ scope: "ip_day", reset: r2.reset });

    const r3 = await rlEmailDay.limit(email.toLowerCase());
    if (!r3.success) return rateLimitResponse({ scope: "email_day", reset: r3.reset });

    // Supabase
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, error: "Supabase env vars missing" }, { status: 500 });
    }
    const supabase = createClient(url, key);

    // Check existing
    const { data: existing } = await supabase
      .from("subscribers")
      .select("verified_at, full_name")
      .eq("email", email)
      .maybeSingle();

    // Upsert (bewaar naam)
    await supabase
      .from("subscribers")
      .upsert({ email, full_name: name ?? existing?.full_name ?? null }, { onConflict: "email" });

    // Already verified → set session cookie en klaar
    if (existing?.verified_at) {
      cookies().set({
        name: "session",
        value: JSON.stringify({ email, name: existing.full_name || name || "" }),
        httpOnly: true, sameSite: "lax", secure: true, path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return NextResponse.json({ ok: true, alreadyVerified: true, email, name: existing.full_name || name || "" });
    }

    // Nieuw verify token
    const { data: tokenRow, error: tokErr } = await supabase
      .from("verify_tokens")
      .insert({ email })
      .select("*")
      .single();
    if (tokErr || !tokenRow?.token) {
      console.error("Create token error:", tokErr);
      return NextResponse.json({ ok: false, error: "Could not create verify token" }, { status: 500 });
    }

    // Origin bepalen
    const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
                 new URL(req.url).origin; // fallback
    const verifyUrl = `${base}/verify?token=${encodeURIComponent(tokenRow.token)}`;

    // Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM = process.env.RESEND_FROM || "no-reply@example.com";
    if (!RESEND_API_KEY) {
      return NextResponse.json({ ok: false, error: "RESEND_API_KEY missing" }, { status: 500 });
    }

    const payload = { from: FROM, to: [email], subject: "Verify your email", html: htmlEmail({ verifyUrl }) };

    let mode = "live", sent = null;
    async function send(extra = {}) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", ...extra },
        body: JSON.stringify(payload),
      });
      const txt = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`Resend failed (${r.status}): ${txt}`);
      return JSON.parse(txt);
    }
    try {
      sent = await send();
    } catch (e) {
      if (String(e.message).includes("(403)")) {
        mode = "preview";
        sent = await send({ "x-resend-ignore-verification": "true" });
      } else {
        throw e;
      }
    }

    return NextResponse.json({
      ok: true, email, mode, verifyUrl, sentId: sent?.id ?? null,
      rate: { ipMinute: r1.remaining, ipDay: r2.remaining, emailDay: r3.remaining },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}