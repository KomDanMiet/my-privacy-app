// app/api/dsar/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { csrfOk } from "@/lib/csrf";
import {
  rlIpMinute,
  rlIpDay,
  rlEmailDay,
  rlUserCompanyDay,
  isBanned,
  rateLimitResponse,
} from "@/lib/ratelimit.js";

/* ---------------- helpers ---------------- */
const norm  = (s) => (s || "").toLowerCase().trim();
const trunc = (s, n) => (s || "").toString().slice(0, n);

function composeSubjectBody({ company, email, name, action }) {
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

  const text = lines.join("\n");
  const html =
    `<div style="font-family:system-ui,Segoe UI,Roboto,Arial">` +
    lines.map(l => `<p>${(l || "").replace(/</g, "&lt;")}</p>`).join("") +
    `</div>`;

  return { subject, text, html };
}
/* ----------------------------------------- */

export async function POST(req) {
  // Optioneel: CSRF/origin check
  if (process.env.ENABLE_CSRF === "1" && !csrfOk(req)) {
    return NextResponse.json({ ok: false, error: "CSRF failed" }, { status: 403 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const { email, name, company, action, honeypot, csrf, toOverride } = payload || {};

    // Honeypot/ban
    if (honeypot) return rateLimitResponse({ reason: "honeypot" });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (await isBanned(ip) || (email && (await isBanned(norm(email))))) {
      return rateLimitResponse({ reason: "banned" });
    }

    // Validatie
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    if (!company?.domain)
      return NextResponse.json({ ok: false, error: "Missing company.domain" }, { status: 400 });
    if (!["delete", "compensate"].includes(action))
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });

    // (Optioneel) eigen HMAC/nonce check behouden
    const secret = process.env.APP_SECRET || "";
    if (secret && csrf) {
      const [nonce, sig] = (csrf || "").split(".");
      const ok =
        sig &&
        (await import("crypto")).createHmac("sha256", secret).update(nonce).digest("base64url") === sig;
      if (!ok) return NextResponse.json({ ok: false, error: "CSRF failed" }, { status: 403 });
    }

    // Rate limits
    const r1 = await rlIpMinute.limit(`dsar:ip:${ip}`);
    if (!r1.success) return rateLimitResponse({ scope: "ip_minute", reset: r1.reset });
    const r2 = await rlIpDay.limit(`dsar:ip:${ip}`);
    if (!r2.success) return rateLimitResponse({ scope: "ip_day", reset: r2.reset });
    const r3 = await rlEmailDay.limit(`dsar:email:${norm(email)}`);
    if (!r3.success) return rateLimitResponse({ scope: "email_day", reset: r3.reset });
    const coKey = `dsar:${norm(email)}:${norm(company?.domain)}:${action}`;
    const r4 = await rlUserCompanyDay.limit(coKey);
    if (!r4.success)
      return NextResponse.json(
        { ok: false, error: "You already sent a request to this company today", reset: r4.reset },
        { status: 429 }
      );

    // Compose alleen onderwerp/inhoud — GEEN 'to' bepalen!
    const safeEmail = trunc(email, 120);
    const safeName  = trunc(name, 80);
    const { subject, text, html } = composeSubjectBody({
      company,
      email: safeEmail,
      name: safeName,
      action,
    });

    // Forward naar de nieuwe send-route die de contact lookup doet
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
    const resp = await fetch(`${base}/api/dsar/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        domain: company.domain,
        subject,
        text,
        html,
        replyTo: safeEmail,
        toOverride, // alleen voor tests; laat weg in productie UI
      }),
    });

    const out = await resp.text();
    return new Response(out, {
      status: resp.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("dsar proxy error", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown" }, { status: 500 });
  }
}
