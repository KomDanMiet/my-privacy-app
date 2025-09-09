export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { oauthClient } from "@/lib/google";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { parse as tldParse } from "tldts";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function extractEmail(text = "") {
  // pakt user@host uit 'Name <user@host>'
  const m = text.match(/[A-Z0-9._%+\-]+@([A-Z0-9.\-]+\.[A-Z]{2,})/i);
  return m ? m[0] : null;
}

function toRegistrableDomain(hostOrEmail = "") {
  let host = hostOrEmail.trim().toLowerCase();
  // als het een e-mailadres is → pak host
  const emailMatch = host.match(/[A-Z0-9._%+\-]+@([A-Z0-9.\-]+\.[A-Z]{2,})/i);
  if (emailMatch) host = emailMatch[1];

  host = host.replace(/^https?:\/\//, "").split("/")[0];
  const parsed = tldParse(host);
  if (parsed.domain) {
    return parsed.publicSuffix ? `${parsed.domain}.${parsed.publicSuffix}` : parsed.domain;
  }
  return host || null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email: string = body.email;
  const days = Math.max(1, Math.min(365, Number(body.days ?? 90)));
  const max = Math.max(10, Math.min(500, Number(body.limit ?? 200)));

  if (!email) {
    return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: row, error: tErr } = await sb
    .from("gmail_tokens")
    .select("token_json")
    .eq("email", email)
    .maybeSingle();

  if (!row?.token_json || tErr) {
    return NextResponse.json({ ok: false, error: "No token found" }, { status: 404 });
  }

  const client = oauthClient();
  client.setCredentials(row.token_json);

  const gmail = google.gmail({ version: "v1", auth: client });

  // recentste mails
  const list = await gmail.users.messages.list({
    userId: "me",
    q: `newer_than:${days}d`,
    maxResults: max,
  });

  const ids = list.data.messages?.map(m => m.id!).filter(Boolean) ?? [];
  let inserted = 0;
  const domainsCount: Record<string, number> = {};

  for (const id of ids) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "Return-Path", "Date", "Message-ID"],
    });

    const headers = msg.data.payload?.headers || [];
    const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "";
    const returnPath = headers.find(h => h.name?.toLowerCase() === "return-path")?.value || "";
    const dateStr = headers.find(h => h.name?.toLowerCase() === "date")?.value || "";

    const fromEmail = extractEmail(from) || extractEmail(returnPath) || "";
    const domain = toRegistrableDomain(fromEmail || returnPath);

    if (!domain) continue;

    const msgDate = dateStr ? new Date(dateStr) : null;

    const { error: insErr } = await sb.from("discovered_senders").upsert(
      {
        email,
        msg_id: id,
        header_from: from || null,
        return_path: returnPath || null,
        domain,
        msg_date: msgDate ? msgDate.toISOString() : null,
      },
      { onConflict: "email,msg_id" }
    );

    if (!insErr) {
      inserted++;
      domainsCount[domain] = (domainsCount[domain] || 0) + 1;
    }
  }

  // top 20 domeinen
  const top = Object.entries(domainsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([domain, count]) => ({ domain, count }));

  return NextResponse.json({
    ok: true,
    scanned: ids.length,
    inserted,
    top,
  });
}