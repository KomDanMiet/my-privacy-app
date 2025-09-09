// app/api/discovery/gmail/run/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { oauthClient } from "@/lib/google";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { parse as parseTld } from "tldts";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Haal e-mailadres uit bv. 'Name <user@host.tld>' */
function extractEmail(text = ""): string | null {
  const m = text.match(/[A-Z0-9._%+\-]+@([A-Z0-9.\-]+\.[A-Z]{2,})/i);
  return m ? m[0] : null;
}

/** Normaliseer host naar registrable domain (bv. vercel.com) */
function hostToDomain(input?: string | null): string | null {
  let s = (input || "").trim().toLowerCase();

  // ruis strippen
  s = s.replace(/^mailto:/, "");
  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0];
  s = s.replace(/^www\./, "");

  const p = parseTld(s);
  if (p.isIp) return null;

  // BELANGRIJK: parseTld(...).domain bevat al "vercel.com" (dus niet ".publicSuffix" erbij plakken)
  if (p.domain) return p.domain;

  // fallback: laatste 2 labels
  const parts = s.split(".").filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return s || null;
}

/** Probeer domain uit e-mailadres; anders behandel input als host/URL */
function addrToDomain(addrOrHost?: string | null): string | null {
  const s = (addrOrHost || "").toLowerCase();
  const m = s.match(/[a-z0-9._%+\-]+@([a-z0-9.\-]+\.[a-z]{2,})/i);
  return hostToDomain(m ? m[1] : s);
}

async function runScan(email: string, days = 90, limit = 200) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: row, error: tokenErr } = await sb
    .from("gmail_tokens")
    .select("token_json")
    .eq("email", email.toLowerCase())
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

    // bepaal domein op basis van From → Return-Path fallback
    const domain = addrToDomain(from) || addrToDomain(returnPath);
    if (!domain) continue;

    const { error: upErr } = await sb.from("discovered_senders").upsert(
      {
        email: email.toLowerCase(),
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
    const email = String(body.email || "").toLowerCase().trim();
    const days = Number(body.days ?? 90);
    const limit = Number(body.limit ?? 200);
    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    const result = await runScan(email, days, limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[gmail/run] POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}

/** GET debug: /api/discovery/gmail/run?email=...&days=&limit= */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = String(url.searchParams.get("email") || "").toLowerCase().trim();
    const days = Number(url.searchParams.get("days") ?? 90);
    const limit = Number(url.searchParams.get("limit") ?? 200);
    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    const result = await runScan(email, days, limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[gmail/run] GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Internal error" }, { status: 500 });
  }
}