// app/api/dsar/send/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Helper: contact ophalen via jouw lookup-endpoint
async function getContact(domain: string, force = false) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const url = `${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}${force ? "&force=1" : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Lookup failed (${r.status})`);
  return r.json(); // { ok, domain, contact }
}

// Helper: bepalen of we veilig mogen mailen
function shouldEmail(contact: any) {
  if (!contact) return false;
  const conf = contact.confidence ?? 0;
  const typeOk = contact.contact_type === "email";
  const confOk = conf >= 60;

  const COOL_DOWN_DAYS = 30;
  const bouncedRecently =
    !!contact.last_bounce_at &&
    Date.now() - new Date(contact.last_bounce_at).getTime() <
      COOL_DOWN_DAYS * 24 * 60 * 60 * 1000;

  return typeOk && confOk && !bouncedRecently;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      domain,
      subject,
      html,
      text,
      replyTo,
      toOverride, // optioneel: forceer een testadres
    } = body || {};

    if (!domain || !subject || !(html || text)) {
      return NextResponse.json(
        { ok: false, error: "Missing domain/subject/body" },
        { status: 400 }
      );
    }

    // 1) Contact ophalen uit cache
    const first = await getContact(domain, false);
    if (!first.ok) {
      return NextResponse.json({ ok: false, error: "Lookup error" }, { status: 502 });
    }
    let contact = first.contact;

    // 2) Beslissen: mailen of fallback
    const forceEmailTo = toOverride as string | undefined;
    const allowEmail = forceEmailTo ? true : shouldEmail(contact);

    // 3) Als mailen niet is toegestaan, force refresh (misschien is er een formulier)
    if (!allowEmail) {
      const refreshed = await getContact(domain, true);
      if (refreshed.ok && refreshed.contact) {
        contact = refreshed.contact;
      }

      // Formulier gevonden? -> fallback
      if (contact?.contact_type === "form" && contact?.value) {
        return NextResponse.json({
          ok: true,
          channel: "form",
          url: contact.value,
          domain,
        });
      }

      // Nog steeds geen betrouwbare e-mail? -> stoppen
      if (!forceEmailTo) {
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
    }

    // 4) E-mailpad (via override of betrouwbare e-mail uit lookup)
    const to =
      forceEmailTo ||
      (contact?.contact_type === "email" ? (contact?.value as string) : undefined);

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "No destination email available" },
        { status: 400 }
      );
    }

    const resp = await resend.emails.send({
      from: "My Privacy App <dsar@jouwdomein.nl>", // stuur vanaf je geverifieerde domein
      to,
      subject,
      html: html ?? undefined,
      text: text ?? "Plain-text fallback.",
      replyTo: replyTo ?? undefined,
      headers: { "X-App": "my-privacy-app" },
    });

    // Let op: bounces worden door je webhook verwerkt
    return NextResponse.json({
      ok: true,
      channel: "email",
      id: resp?.data?.id,
      to,
      domain,
    });
  } catch (e: any) {
    console.error("DSAR send error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown" },
      { status: 500 }
    );
  }
}
