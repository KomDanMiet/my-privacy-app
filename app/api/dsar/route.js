// app/api/dsar/route.js
import { csrfOk } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  rlIpMinute,
  rlIpDay,
  rlEmailDay,
  rlUserCompanyDay,   // <- let op: met 'l'
  isBanned,
  rateLimitResponse,
} from "@/lib/ratelimit.js";
import crypto from "crypto";

/* --------------------- helpers --------------------- */
function getIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
const norm  = (s) => (s || "").toLowerCase().trim();
const trunc = (s, n) => (s || "").toString().slice(0, n);

function buildToAddress(company) {
  const dom = norm(company?.domain);
  if (!dom) return null;
  // later vervangen door vendors-lookup
  return `privacy@${dom}`;
}

function composeEmail({ company, email, name, action }) {
  const to = buildToAddress(company) || "privacy@example.com";
  const subject =
    action === "delete"
      ? "Data deletion request under GDPR (Art. 17)"
      : "Data access/compensation request under GDPR";

  const lines = [
    `Dear ${company?.name || "Data Protection Officer"},`,
    "",
    "I am exercising my rights under the GDPR.",
    action === "delete"
      ? "Please delete all personal data you process about me and confirm this deletion in writing."
      : "Please provide access to all personal data you process about me, including purposes, categories, recipients/third-parties and retention periods. If you wish to continue processing my data, please provide a reasonable compensation offer in exchange for my (renewed) consent.",
    "",
    `Email address: ${email}`,
    name ? `Full name: ${name}` : null,
    "",
    "Please respond within 30 days as required by the GDPR.",
    "",
    "Kind regards,",
    name || "(your name)",
  ].filter(Boolean);

  return { to, subject, body: lines.join("\n") };
}
/* --------------------------------------------------- */

/**
 * DSAR endpoint
 */
export async function POST(req) {
  try {
    // --- CSRF / Origin check ---
    if (!csrfOk(req)) {
      return NextResponse.json({ ok: false, error: "CSRF failed" }, { status: 403 });
    }

    const ip = getIp(req);
    const payload = await req.json();
    const { email, name, company, action, honeypot, csrf } = payload || {};

    // honeypot + banlist
    if (honeypot) return rateLimitResponse({ reason: "honeypot" });
    if (await isBanned(ip) || await isBanned(norm(email))) {
      return rateLimitResponse({ reason: "banned" });
    }

    // validatie
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }
    if (!company?.domain && !company?.name) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }
    if (!["delete", "compensate"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    // optionele HMAC/CSRF token (als APP_SECRET is gezet)
    const secret = process.env.APP_SECRET || "";
    if (secret) {
      const [nonce, sig] = (csrf || "").split(".");
      const ok =
        sig &&
        crypto.createHmac("sha256", secret).update(nonce).digest("base64url") === sig;
      if (!ok) return NextResponse.json({ ok: false, error: "CSRF failed" }, { status: 403 });
    }

    // rate limits
    const r1 = await rlIpMinute.limit(`dsar:ip:${ip}`);
    if (!r1.success) return rateLimitResponse({ scope: "ip_minute", reset: r1.reset });

    const r2 = await rlIpDay.limit(`dsar:ip:${ip}`);
    if (!r2.success) return rateLimitResponse({ scope: "ip_day", reset: r2.reset });

    const r3 = await rlEmailDay.limit(`dsar:email:${norm(email)}`);
    if (!r3.success) return rateLimitResponse({ scope: "email_day", reset: r3.reset });

    // per user–company–action cooldown (24h)
    const coKey = `dsar:${norm(email)}:${norm(company?.domain || company?.name)}:${action}`;
    const r4 = await rlUserCompanyDay.limit(coKey);
    if (!r4.success) {
      return NextResponse.json(
        { ok: false, error: "You already sent a request to this company today", reset: r4.reset },
        { status: 429 }
      );
    }

    // compose
    const safeEmail = trunc(email, 120);
    const safeName  = trunc(name, 80);
    const { to, subject, body } = composeEmail({
      company,
      email: safeEmail,
      name: safeName,
      action,
    });

    // supabase
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, error: "Supabase env missing" }, { status: 500 });
    }
    const supabase = createClient(url, key);

    // log request
    const { data: ins, error: insErr } = await supabase
      .from("dsar_requests")
      .insert({
        email: safeEmail,
        full_name: safeName || null,
        company_domain: company?.domain || null,
        company_name: company?.name || null,
        action,
        to,
        subject,
        body,
        status: "previewed",
        ip,
      })
      .select("id, created_at, status")
      .single();

    if (insErr) throw insErr;
    const dsarId = ins.id;

    // send/preview gate
    let MODE = (process.env.DSAR_SEND_MODE || "preview").toLowerCase();
    const isProd = process.env.VERCEL_ENV === "production";
    const isOwn  = (process.env.NEXT_PUBLIC_BASE_URL || "").includes("discodruif.com");
    if (!(isProd && isOwn) && MODE === "live") MODE = "preview";
    const effectiveMode = MODE === "live" ? "send" : "preview";

    let sentId = null;
    let finalStatus = "previewed";

    if (effectiveMode === "send") {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const FROM = process.env.RESEND_FROM || "no-reply@example.com";
      const BCC  = process.env.RESEND_BCC || null;

      if (RESEND_API_KEY && FROM) {
        const payloadSend = {
          from: FROM,
          to: [to],
          subject,
          text: body,
          reply_to: safeEmail,
          bcc: BCC ? [BCC] : undefined,
          headers: {
            "X-DSAR-Company": company?.domain || company?.name || "unknown",
            "X-DSAR-Action": action,
          },
        };

        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadSend),
        });

        const txt = await r.text().catch(() => "");
        if (r.ok) {
          const sent = JSON.parse(txt);
          sentId = sent?.id ?? null;
          finalStatus = "sent";
          await supabase
            .from("dsar_requests")
            .update({
              status: "sent",
              provider: "resend",
              provider_id: sentId,
              sent_at: new Date().toISOString(),
            })
            .eq("id", dsarId);
        } else {
          await supabase
            .from("dsar_requests")
            .update({
              last_error: `resend:${r.status}`,
              last_error_body: txt?.slice(0, 4000) || null,
            })
            .eq("id", dsarId);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      id: dsarId,
      status: finalStatus,
      to,
      subject,
      body,
      replyTo: safeEmail,
      hasAdminBcc: !!process.env.RESEND_BCC,
      mode: effectiveMode,
      sentId,
    });
  } catch (e) {
    console.error("dsar route error", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}