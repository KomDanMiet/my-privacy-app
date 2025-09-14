// app/api/dsar/send/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

/* ---------- helpers ---------- */
function normDomain(input: string) {
  let d = (input || "").trim().toLowerCase();
  d = d.replace(/^mailto:/, "");
  if (d.includes("@")) d = d.split("@")[1];             // e-mail -> domein
  d = d.replace(/^https?:\/\//, "").split("/")[0];      // URL -> host
  d = d.replace(/^www\./, "");
  return d;
}

function shouldEmail(contact: any) {
  if (!contact) return false;
  const MIN_CONF = Number(process.env.DSAR_MIN_CONF ?? 60);
  const COOL_DOWN_DAYS = Number(process.env.DSAR_BOUNCE_COOLDOWN_DAYS ?? 30);
  const confOk = (contact.confidence ?? 0) >= MIN_CONF;
  const recentBounce =
    !!contact.last_bounce_at &&
    Date.now() - new Date(contact.last_bounce_at).getTime() <
      COOL_DOWN_DAYS * 24 * 60 * 60 * 1000;
  return contact.contact_type === "email" && confOk && !recentBounce;
}

async function getContact(domain: string, force = false) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${
    force ? "&force=1" : ""
  }`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return j as { ok: boolean; error?: string; contact?: any };
}
/* ---------------------------- */

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { domain, subject, html, text, replyTo, toOverride } = body || {};

    if (!domain || !subject || !(html || text)) {
      return NextResponse.json(
        { ok: false, error: "Missing domain/subject/body" },
        { status: 400 }
      );
    }

    const d = normDomain(domain);
    if (!d || !d.includes(".")) {
      return NextResponse.json({ ok: false, error: "Invalid domain" }, { status: 400 });
    }

    // 1) contact uit cache
    let { ok, contact, error } = await getContact(d, false);
    if (!ok) {
      return NextResponse.json({ ok: false, error: error || "Lookup failed" }, { status: 502 });
    }

    // 2) beslissen: mailen of refresh/fallback
    const forceEmailTo = (toOverride as string) || undefined;

    if (!forceEmailTo && !shouldEmail(contact)) {
      const refreshed = await getContact(d, true);
      if (refreshed.ok) contact = refreshed.contact;
    }

    // Fallback: formulier
    if (!forceEmailTo && contact?.contact_type === "form" && contact?.value) {
      return NextResponse.json({
        ok: true,
        channel: "form",
        url: contact.value,
        domain: d,
      });
    }

    // 3) e-mailpad
    const to =
      forceEmailTo ||
      (contact?.contact_type === "email" ? (contact.value as string) : undefined);

    if (!to) {
      return NextResponse.json(
        {
          ok: false,
          error: "No reliable contact found",
          hint:
            "Geen valide e-mailkanaal met voldoende confidence of recent gebounced. Toon het formulier als dat er is of vraag om handmatig contact.",
          contact,
        },
        { status: 404 }
      );
    }

    // privacy@ guard: alleen toestaan als 'ie echt uit een high-confidence lookup komt
    const isPrivacyGuess = to.toLowerCase().startsWith("privacy@");
    const fromLookupHighConf =
      contact?.contact_type === "email" &&
      (contact?.confidence ?? 0) >= Number(process.env.DSAR_MIN_CONF ?? 60);

    if (!forceEmailTo && isPrivacyGuess && !fromLookupHighConf) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Blocked unsafe fallback address (privacy@) without high-confidence lookup.",
        },
        { status: 409 }
      );
    }

    // 4) versturen met Resend
    const FROM =
      process.env.RESEND_FROM || "My Privacy App <dsar@discodruif.com>";
    const { data, error: sendErr } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: html ?? undefined,
      text: text ?? undefined,
      replyTo: replyTo ?? undefined, // camelCase in Resend v6
      headers: { "X-App": "my-privacy-app", "X-DSAR-Domain": d },
    });

    if (sendErr) {
      console.error("Resend error:", sendErr);
      return NextResponse.json(
        { ok: false, error: sendErr.message || "Resend failed" },
        { status: 502 }
      );
    }

    const messageId = data?.id ?? null;
// right after: const messageId = data?.id ?? null;

// derive who is making the DSAR (bulk passes replyTo = user email)
const requestEmail =
  (typeof (replyTo ?? "") === "string" ? String(replyTo) : null) ?? null;

try {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await sb
    .from("dsar_messages")
    .insert({
      request_email: requestEmail, // e.g., "maurits.vaneck01@gmail.com"
      target_domain: d,            // vendor domain
      channel: "email",
      status: "sent",
      provider_id: messageId,      // <-- matches Resend event.data.id
      to_address: to,
      payload: { subject, text: text ?? null, html: html ?? null },
    });
} catch (e) {
  console.warn("dsar_messages insert warning:", (e as any)?.message || e);
}

    // 5) (optioneel) audit-log in Supabase
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await sb.from("dsar_requests").insert({
        company_domain: d,
        to,
        subject,
        body: text ?? null,
        html: html ?? null,
        status: "sent",
        provider: "resend",
        provider_id: messageId,
        sent_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("dsar_requests insert warning:", (e as any)?.message || e);
    }

    console.log("[DSAR_SEND]", {
      domain: d,
      to,
      confidence: contact?.confidence ?? null,
      last_bounce_at: contact?.last_bounce_at ?? null,
      id: messageId,
    });

    return NextResponse.json({
      ok: true,
      channel: "email",
      id: messageId,
      to,
      domain: d,
    });
  } catch (e: any) {
    console.error("DSAR send error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown" },
      { status: 500 }
    );
  }
}
