// app/api/dsar/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

function toHost(v = "") {
  let d = String(v).trim().toLowerCase();
  d = d.replace(/^mailto:/, "");
  if (d.includes("@")) d = d.split("@")[1];           // e-mail -> domein
  d = d.replace(/^https?:\/\//, "").split("/")[0];    // URL -> host
  d = d.replace(/^www\./, "");
  return d;
}

export async function POST(req) {
  const payload = await req.json().catch(() => ({}));
  const { email, name, company, action = "delete", toOverride } = payload || {};
  const domain = toHost(company?.domain || company?.website || company?.url || "");

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ ok:false, error:"Invalid email" }, { status:400 });
  }
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ ok:false, error:"Invalid company domain" }, { status:400 });
  }

  // subject/body op basis van action
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
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial">${lines
    .map(l => `<p>${(l || "").replace(/</g, "&lt;")}</p>`)
    .join("")}</div>`;

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://discodruif.com";
  const resp = await fetch(`${base}/api/dsar/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      domain,
      subject,
      text,
      html,
      replyTo: email,
      toOverride, // alleen voor tests; in UI normaal weglaten
    }),
  });

  const out = await resp.text();
  return new Response(out, {
    status: resp.status,
    headers: { "content-type": "application/json" },
  });
}
