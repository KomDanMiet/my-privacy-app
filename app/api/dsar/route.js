// app/api/dsar/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function buildDsarEmail({ action, company, email, name }) {
  const to = company?.dpoEmail
    ? company.dpoEmail
    : `privacy@${company?.domain || "example.com"}`;

  const subject =
    action === "delete"
      ? "Data deletion request under GDPR (Art. 17)"
      : "Data access/compensation request under GDPR";

  const lines = [
    `Dear ${company?.name || "Data Protection Officer"},`,
    "",
    "I am exercising my rights under the GDPR.",
    action === "delete"
      ? "Please delete all personal data you hold about me and confirm in writing."
      : "Please provide access to all personal data you process about me, including purposes, recipients and retention. If you wish to continue processing, I request a fair compensation proposal for my renewed consent.",
    "",
    `Email address: ${email}`,
    name ? `Full name: ${name}` : null,
    "",
    "Please respond within 30 days as required by the GDPR.",
    "",
    "Kind regards,",
    name || "(Your name)",
  ].filter(Boolean);

  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial">
    ${lines.map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("")}
  </div>`;

  return { to, subject, html };
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const preview = url.searchParams.get("preview") === "1";

    const { action, company, email, name } = await req.json();
    if (!["delete","compensate"].includes(action)) {
      return NextResponse.json({ ok:false, error:"Invalid action" }, { status:400 });
    }
    if (!company || !email) {
      return NextResponse.json({ ok:false, error:"Missing company/email" }, { status:400 });
    }

    const { to, subject, html } = buildDsarEmail({ action, company, email, name });

    // DB (server role)
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok:false, error:"Supabase env missing" }, { status:500 });
    }
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Altijd loggen (status = previewed)
    const { data: row, error: insErr } = await db
      .from("dsar_requests")
      .insert({
        email,
        full_name: name ?? null,
        company_name: company.name || null,
        company_domain: company.domain || null,
        action,
        to_address: to,
        subject,
        html,
        status: "previewed"
      })
      .select("*")
      .single();

    if (insErr) {
      console.error("dsar insert error", insErr);
      return NextResponse.json({ ok:false, error:"Could not log DSAR" }, { status:500 });
    }

    // 2) Als we alleen willen PREVIEWEN (geen verzending)
    //    (Vandaag: altijd; DSAR_SEND staat op false)
    const SEND = String(process.env.DSAR_SEND || "").toLowerCase() === "true";
    if (!SEND || preview) {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        requestId: row.id,
        to,
        subject,
        html
      });
    }

    // (Later) verzend-code hier plaatsen als DSAR_SEND=true
    // Voor vandaag NIET uitvoeren.
    return NextResponse.json({
      ok:true,
      mode:"noop",
      requestId: row.id
    });
  } catch (e) {
    console.error("dsar error", e);
    return NextResponse.json({ ok:false, error: e.message }, { status:500 });
  }
}