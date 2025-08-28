// app/api/subscribe/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Helpers
 */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE; // service role (server-only)
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function okJson(data = {}) {
  return NextResponse.json({ ok: true, ...data });
}
function errJson(message, status = 500, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/**
 * POST /api/subscribe
 * Body: { email: string }
 */
export async function POST(req) {
  try {
    const { email } = await req.json();

    // 0) Validatie
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return errJson("Invalid email", 400);
    }

    // 1) Supabase: opslaan/aanmaken
    const supa = getSupabaseAdmin();

    // a) insert in subscribers (negeer duplicates)
    const { error: insErr } = await supa
      .from("subscribers")
      .insert({ email });

    // 23505 = unique_violation (email al aanwezig) -> geen hard error
    if (insErr && insErr.code !== "23505") {
      console.error("Insert subscribers error:", insErr);
      return errJson("DB insert failed", 500);
    }

    // b) token aanmaken
    const { data: tokRow, error: tokErr } = await supa
      .from("verify_tokens")
      .insert({ email })
      .select("token")
      .single();

    if (tokErr) {
      console.error("Create token error:", tokErr);
      return errJson("Token create failed", 500);
    }

    // 2) Verificatie-URL
    const base =
      process.env.NEXT_PUBLIC_BASE_URL || "https://my-privacy-app.vercel.app";
    const verifyUrl = `${base}/verify?token=${tokRow.token}`;

    // 3) Mail via Resend (test-modus: alleen je eigen adres toegestaan)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return errJson("RESEND_API_KEY missing", 500);
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "My Privacy App <onboarding@resend.dev>", // test-modus afzender
        to: [email], // in test-modus moet dit je eigen adres zijn
        subject: "Bevestig je e-mail",
        html: `
          <p>Hoi! Klik op de link hieronder om je e-mail te bevestigen:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Als jij dit niet was, kun je deze mail negeren.</p>
        `,
      }),
    });

    const text = await resp.text();
    // Optioneel: log alleen in server (zie Vercel function logs)
    console.log("RESEND status:", resp.status, "ok:", resp.ok, "body:", text);

    if (!resp.ok) {
      // Geef de reden terug voor snelle diagnose in Network tab
      return errJson("resend_failed", 500, { resendStatus: resp.status, resendBody: text });
    }

    // 4) Klaar
    return okJson();
  } catch (e) {
    console.error("Subscribe fatal error:", e);
    return errJson(e.message || "Server error", 500);
  }
}
