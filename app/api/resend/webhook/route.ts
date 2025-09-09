// app/api/resend/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

/** Map Resend event -> our status */
function statusFromType(type?: string) {
  switch (type) {
    case "email.sent":       return "sent";
    case "email.delivered":  return "delivered";
    case "email.bounced":    return "bounced";
    case "email.complained": return "complained";
    case "email.opened":     return "opened";   // optional analytics
    default:                 return "unknown";
  }
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Missing RESEND_WEBHOOK_SECRET" }, { status: 500 });
  }

  const raw = await req.text();
  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: "Missing Svix headers" }, { status: 400 });
  }

  // Verify signature
  let event: any;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(raw, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  const type = event?.type as string | undefined;
  const data = event?.data ?? {};

  // IMPORTANT: Resend puts the message UUID here
  const providerId: string | null = data.email_id ?? null;

  // "to" can be string or string[]
  let toEmail: string | null = null;
  if (typeof data.to === "string") toEmail = data.to.toLowerCase();
  else if (Array.isArray(data.to) && data.to.length > 0) toEmail = String(data.to[0]).toLowerCase();

  // Try domain from header first (we added X-Dsar-Domain when sending)
  const headerDomain =
    Array.isArray(data.headers)
      ? (data.headers.find((h: any) => (h?.name ?? "").toLowerCase() === "x-dsar-domain")?.value ?? null)
      : null;

  const toDomain =
    headerDomain ??
    (toEmail && toEmail.includes("@") ? toEmail.split("@")[1] : null);

  const reason: string | null = data.reason ?? null;
  const status = statusFromType(type);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1) Update dsar_messages by provider_id (idempotent)
  if (providerId) {
    await supa
      .from("dsar_messages")
      .upsert(
        { provider_id: providerId, status, payload: event },
        { onConflict: "provider_id" }
      );
  }

  // 2) Optional: tune vendors_contact confidence by domain
  if (toDomain) {
    if (type === "email.bounced") {
      await supa
        .from("vendors_contact")
        .update({
          last_bounce_at: new Date().toISOString(),
          bounce_reason: reason,
          confidence: 30,
          checked_at: new Date().toISOString(),
        })
        .eq("domain", toDomain);
    } else if (type === "email.delivered") {
      try {
        const { error } = await supa.rpc("set_confidence_max", { d: toDomain, c: 80 });
        if (error) throw error;
      } catch {
        await supa
          .from("vendors_contact")
          .update({
            confidence: 80,
            checked_at: new Date().toISOString(),
          })
          .eq("domain", toDomain);
      }
    }
  }

  return NextResponse.json({ ok: true, status, id: providerId });
}

// (Optional) tiny GET for sanity checks in a browser;
// safe to keep or remove.
export async function GET() {
  return NextResponse.json({ ok: true, path: "/api/resend/webhook" });
}
