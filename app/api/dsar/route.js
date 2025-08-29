// app/api/dsar/route.js
import { NextResponse } from "next/server";

/**
 * ENV expected (Vercel → Project → Settings → Environment Variables):
 * - RESEND_API_KEY = re_********
 * - RESEND_FROM    = noreply@yourdomain.com   (leeg laten = testmodus via onboarding@resend.dev)
 *
 * Request body (JSON):
 * {
 *   "email": "user@example.com",          // required: user's email
 *   "name": "First Last",                 // optional
 *   "action": "delete" | "compensate",    // required
 *   "company": {                          // required
 *      "name": "Meta (Facebook)",
 *      "domain": "facebook.com",
 *      "privacyEmail": "privacy@support.facebook.com" // optional
 *   }
 * }
 *
 * Response:
 * { ok: boolean, sentTo: string, mode: "company" | "preview", note?: string }
 */

// ---------- helpers ----------
function resolveCompanyEmail(company) {
  if (!company) return null;
  if (company.privacyEmail) return company.privacyEmail;
  if (company.domain) return `privacy@${company.domain}`;
  return null;
}

function buildSubject({ company, action }) {
  const base =
    action === "compensate"
      ? "Request for compensation regarding personal data"
      : "Request for deletion of personal data";
  return `${base} – ${company?.name || "Data Controller"}`;
}

function buildEmailBody({ email, name, company, action }) {
  const lines = [
    `Dear ${company?.name || "Data Protection Officer"},`,
    "",
    "Under the General Data Protection Regulation (GDPR), I am exercising my rights as a data subject.",
    "",
    "I request the following:",
    "1) Access to all personal data you process about me, including purposes of processing, categories of data, recipients/third parties, and retention periods.",
    action === "compensate"
      ? "2) If you intend to continue processing my personal data, please provide an appropriate compensation proposal in return for my (renewed) consent."
      : "2) If there is no lawful basis for processing, I request the immediate deletion of my personal data.",
    "",
    "Important:",
    action === "compensate"
      ? "- If no appropriate compensation proposal is provided, I expect deletion in accordance with Article 17 GDPR."
      : "- This request is free of charge and you are required to comply under the GDPR.",
    "",
    `Email address: ${email}`,
    name ? `Name: ${name}` : null,
    "",
    "Please respond within the statutory period of 30 days.",
    "",
    "Kind regards,",
    name || "(Your name)",
  ].filter(Boolean);

  return lines.join("\n");
}

// ---------- route ----------
export async function POST(req) {
  try {
    const { email, name, action, company } = await req.json();

    // basic validation
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }
    if (!company || (!company.name && !company.domain)) {
      return NextResponse.json({ ok: false, error: "Company missing" }, { status: 400 });
    }
    if (!["delete", "compensate"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    // Resend config
    const apiKey = process.env.RESEND_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const configuredFrom = (process.env.RESEND_FROM || "").trim();
    const from =
      configuredFrom || "My Privacy App <onboarding@resend.dev>"; // testmodus afzender

    const isTestMode = from.includes("onboarding@resend.dev");
    const companyEmail = resolveCompanyEmail(company);

    // In testmodus: stuur naar de gebruiker zelf (preview).
    // In productie: stuur naar het bedrijf; fallback naar gebruiker als geen adres gevonden.
    const to = isTestMode ? email : (companyEmail || email);
    const mode = isTestMode ? "preview" : companyEmail ? "company" : "preview";

    const subject = buildSubject({ company, action });
    const text = buildEmailBody({ email, name, company, action });

    // send via Resend REST (zonder SDK)
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
      }),
    });

    const body = await resp.text();
    console.log("DSAR SEND:", { to, mode, status: resp.status, ok: resp.ok, body });

    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: "send_failed", details: { status: resp.status, body } },
        { status: 500 }
      );
    }

    const note =
      mode === "preview"
        ? "Test mode: message sent to the user (not the company). Set RESEND_FROM with a verified domain to send directly to companies."
        : undefined;

    return NextResponse.json({ ok: true, sentTo: to, mode, note });
  } catch (e) {
    console.error("DSAR error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Server error" }, { status: 500 });
  }
}
