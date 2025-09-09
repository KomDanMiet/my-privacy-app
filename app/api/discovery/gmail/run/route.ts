// app/api/discovery/gmail/run/route.ts
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
  const m = text.match(/[A-Z0-9._%+\-]+@([A-Z0-9.\-]+\.[A-Z]{2,})/i);
  return m ? m[0] : null;
}

function toRegistrableDomain(hostOrEmail = "") {
  let host = hostOrEmail.trim().toLowerCase();
  const em = host.match(/[A-Z0-9._%+\-]+@([A-Z0-9.\-]+\.[A-Z]{2,})/i);
  if (em) host = em[1];
  host = host.replace(/^https?:\/\//, "").split("/")[0];
  const p = tldParse(host);
  if (p.domain) return p.publicSuffix ? `${p.domain}.${p.publicSuffix}` : p.domain;
  return host || null;
}

async function runScan(email: string, days = 90, limit = 200) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: row, error: tokenErr } = await sb
    .from("gmail_tokens")
    .select("token_json")
    .eq("email", email)
    .maybeSingle();

  if (tokenErr) throw new Error(`Supabase token query failed: ${tokenErr.message}`);
  if (!row?.token_json) throw new Error("No token found for this email");

  const client = oauthClient();
  client.setCredentials(row.token_json);

  const gmail = google.gmail({ version: "v1", auth: client });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `newer_than:${Math.max(1, Math.min(365, days))}d`,
    maxResults: Math.max(10, Math.min(500, limit)),
  });

  const ids = list.data.messages?.map(m => m.id!).filter(Boolean) ?? [];
  let inserted = 0;
  const counts: Record<string, number> = {};

  for (const id of ids) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "Return-Path", "Date"],
    });

    const headers = msg.data.payload?.headers || [];
    const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "";
    const returnPath = headers.find(h => h.name?.toLowerCase() === "return-path")?.value || "";
    const dateStr = headers.find(h => h.name?.toLowerCase() === "date")?.value || "";
    const msgDate = dateStr ? new Date(dateStr) : null;

    const fromEmail = extractEmail(from) || extractEmail(returnPath) || "";
    const domain = toRegistrableDomain(fromEmail || returnPath);
    if (!domain) continue;

    const { error: upErr } = await sb.from("discovered_senders").upsert(
      {
        email,
        msg_id: id!,
        header_from: from || null,
        return_path: returnPath || null,
        domain,
        msg_date: msgDate ? msgDate.toISOString() : null,
      },
      { onConflict: "email,msg_id" }
    );
    if (!upErr) {
      inserted++;
      counts[domain] = (counts[domain] || 0) + 1;
    }
  }

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([domain, count]) => ({ domain, count }));

  return { scanned: ids.length, inserted, top };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email as string;
    const days = Number(body.days ?? 90);
    const limit = Number(body.limit ?? 200);
    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const result = await runScan(email, days, limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[gmail/run] POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}

/** Handige debug: je kunt ook GET gebruiken: /api/discovery/gmail/run?email=...&days=&limit= */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email") || "";
    const days = Number(url.searchParams.get("days") ?? 90);
    const limit = Number(url.searchParams.get("limit") ?? 200);
    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const result = await runScan(email, days, limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[gmail/run] GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}