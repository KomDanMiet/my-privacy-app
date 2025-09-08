export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { csrfOk } from "@/lib/csrf";
import {
  rlIpMinute, rlIpDay, rlEmailDay, rlUserCompanyDay, isBanned, rateLimitResponse,
} from "@/lib/ratelimit.js";

/* helpers */
const norm = (s) => (s || "").toLowerCase().trim();
const trunc = (s, n) => (s || "").toString().slice(0, n);
function normDomain(input = "") {
  let d = String(input).trim().toLowerCase();
  d = d.replace(/^mailto:/, "");
  if (d.includes("@")) d = d.split("@")[1];          // email -> domein
  d = d.replace(/^https?:\/\//, "").split("/")[0];   // URL -> host
  d = d.replace(/^www\./, "");
  return d;
}
function composeSubjectBody({ company, email, name, action }) {
  const subject =
    action === "delete"
      ? "Data deletion request under GDPR (Art. 17)"
      : "Data access/compensation request under GDPR";
  const lines = [
    `Dear ${company?.name || "Data Protection Officer"},`,
    "", "I am exercising my rights under the GDPR.",
    action === "delete"
      ? "Please delete all personal data you process about me and confirm this deletion in writing."
      : "Please provide access to all personal data you process about me, including purposes, categories, recipients/third-parties and retention periods. If you wish to continue processing my data, please provide a reasonable compensation offer in exchange for my (renewed) consent.",
    "", `Email address: ${email}`, name ? `Full name: ${name}` : null,
    "", "Please respond within 30 days as required by the GDPR.", "", "Kind regards,", name || "(your name)",
  ].filter(Boolean);
  const text = lines.join("\n");
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial">${lines.map(l => `<p>${(l||"").replace(/</g,"&lt;")}</p>`).join("")}</div>`;
  return { subject, text, html };
}

export async function POST(req) {
  if (process.env.ENABLE_CSRF === "1" && !csrfOk(req)) {
    return NextResponse.json({ ok:false, error:"CSRF failed" }, { status:403 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const payload = await req.json().catch(()=> ({}));
  const { email, name, company, action, honeypot, csrf, toOverride } = payload || {};
  if (honeypot) return rateLimitResponse({ reason:"honeypot" });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok:false, error:"Invalid email" }, { status:400 });
  if (!company || !["delete","compensate"].includes(action)) return NextResponse.json({ ok:false, error:"Invalid input" }, { status:400 });

  const domain = normDomain(company.domain || company.website || company.url || "");
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ ok:false, error:"Invalid company domain" }, { status:400 });
  }

  // rate limits (zoals je al had)
  const r1 = await rlIpMinute.limit(`dsar:ip:${ip}`); if (!r1.success) return rateLimitResponse({ scope:"ip_minute", reset:r1.reset });
  const r2 = await rlIpDay.limit(`dsar:ip:${ip}`);     if (!r2.success) return rateLimitResponse({ scope:"ip_day", reset:r2.reset });
  const r3 = await rlEmailDay.limit(`dsar:email:${norm(email)}`); if (!r3.success) return rateLimitResponse({ scope:"email_day", reset:r3.reset });
  const r4 = await rlUserCompanyDay.limit(`dsar:${norm(email)}:${domain}:${action}`);
  if (!r4.success) return NextResponse.json({ ok:false, error:"You already sent a request to this company today", reset:r4.reset }, { status:429 });

  const safeEmail = trunc(email,120);
  const safeName  = trunc(name,80);
  const { subject, text, html } = composeSubjectBody({ company:{...company, domain}, email:safeEmail, name:safeName, action });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
  console.log("[DSAR_PROXY_IN]", { raw: company?.domain, domain });
  const resp = await fetch(`${base}/api/dsar/send`, {
    method: "POST",
    headers: { "content-type":"application/json" },
    cache: "no-store",
    body: JSON.stringify({ domain, subject, text, html, replyTo: safeEmail, toOverride }),
  });
  const out = await resp.text();
  return new Response(out, { status: resp.status, headers: { "content-type":"application/json" } });
}

