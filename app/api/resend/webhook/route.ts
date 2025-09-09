// app/api/resend/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function hmacSha256(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function POST(req: Request) {
  const VERIFY = process.env.RESEND_WEBHOOK_SECRET ? true : false;
  const raw = await req.text();
  const hdr = req.headers.get("x-resend-signature") || req.headers.get("X-Resend-Signature");

  if (VERIFY) {
    const expected = hmacSha256(process.env.RESEND_WEBHOOK_SECRET!, raw);
    if (!hdr || hdr !== expected) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  let evt: any = {};
  try { evt = JSON.parse(raw); } catch { /* ignore */ }

  const type = evt?.type;
  const toEmail = (evt?.data?.to || "").toLowerCase();
  const reason = evt?.data?.reason || null;
  const domain = toEmail.includes("@") ? toEmail.split("@")[1] : null;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (type === "email.bounced" && domain) {
    await sb.from("vendors_contact")
      .update({
        last_bounce_at: new Date().toISOString(),
        bounce_reason: reason,
        confidence: 30,
        bounce_count: (evt?.data?.bounce_count ?? null) // alleen als je trigger hebt; anders weg laten
      })
      .eq("domain", domain);

    return NextResponse.json({ ok: true });
  }

  // (optioneel) delivered → confidence iets ophogen
  if (type === "email.delivered" && domain) {
    // laat waarde met max 90
    try {
      const { error } = await sb.rpc("set_confidence_max", { d: domain, c: 80 });
      if (error) {
        throw error;
      }
    } catch {
      // fallback: simpele update (min)
      await sb.from("vendors_contact")
        .update({ confidence: 80, checked_at: new Date().toISOString() })
        .eq("domain", domain);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: type ?? "unknown" });
}
