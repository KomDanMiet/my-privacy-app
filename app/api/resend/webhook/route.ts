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
    case "email.sent":        return "sent";
    case "email.delivered":   return "delivered";
    case "email.bounced":     return "bounced";
    case "email.complained":  return "complained";
    case "email.opened":      return "opened";   // optional, for analytics
    default:                  return "unknown";
  }
}

export async function POST(req: Request) {
  // 1) Verify Svix signature
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

  let event: any;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(raw, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  // Resend payload shape: { type, data: { id, to, subject, reason?, ... } }
  const type = event?.type as string | undefined;
  const data = event?.data ?? {};
  const resendId: string | undefined = data.id;             // <-- use this to match dsar_messages.provider_id
  const toEmail: string = (data.to || "").toLowerCase();
  const toDomain = toEmail.includes("@") ? toEmail.split("@")[1] : null;
  const reason: string | null = data.reason ?? null;

  const status = statusFromType(type);

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2) Update dsar_messages by provider_id (idempotent)
  if (resendId) {
    // Upsert to be safe if the "sent" row wasn't inserted for some reason
    await supa
      .from("dsar_messages")
      .upsert(
        { provider_id: resendId, status, payload: event },   // keep raw event for audit
        { onConflict: "provider_id" }
      );
  }

  // 3) Optional: maintain vendors_contact confidence by recipient domain
  if (toDomain) {
    if (type === "email.bounced") {
      // lower confidence + note bounce
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
      // raise confidence (cap at 80–90); try RPC first, fall back to update
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

  return NextResponse.json({ ok: true, status, id: resendId ?? null });
}
