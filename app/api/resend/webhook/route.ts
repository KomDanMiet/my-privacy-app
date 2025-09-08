// app/api/resend/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const evt = await req.json(); // { type: 'email.bounced', data: { to, reason, ... } }
  try {
    if (evt?.type === "email.bounced") {
      const toEmail: string = evt?.data?.to ?? "";
      const domain = toEmail.split("@")[1]?.toLowerCase();
      if (domain) {
        await supabase.from("vendors_contact").update({
          last_bounce_at: new Date().toISOString(),
          confidence: 30
        }).eq("domain", domain);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
