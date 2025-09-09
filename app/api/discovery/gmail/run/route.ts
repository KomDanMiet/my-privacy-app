export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { parseDomain, fromUrl } from "tldts";

function hostToDomain(host: string) {
  try {
    const p = parseDomain(fromUrl(host)?.hostname || host);
    // p.domain + p.publicSuffix => registrableDomain
    // Fallback: return host
    return (p && "domain" in p && p.domain && p.publicSuffix)
      ? `${p.domain}.${p.publicSuffix}` : host.replace(/^www\./, "");
  } catch { return host.replace(/^www\./, ""); }
}

function extractDomainFromFromHeader(value = "") {
  // pakt tussen <...> of na @
  const m = value.match(/<([^>]+)>/);
  const addr = (m ? m[1] : value).split(/\s/).pop() || "";
  const at = addr.indexOf("@");
  const host = at > -1 ? addr.slice(at + 1) : addr;
  return hostToDomain(host.trim().toLowerCase());
}

const IGNORE = new Set([
  "gmail.com","googlemail.com","outlook.com","hotmail.com","live.com",
  "icloud.com","me.com","yahoo.com","proton.me","protonmail.com",
  "pm.me","ziggo.nl","kpnmail.nl","telenet.be"
]);

async function lookup(domain: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const r = await fetch(`${base}/api/contact/lookup?domain=${encodeURIComponent(domain)}&force=1`, { cache: "no-store" });
  return r.json().catch(() => ({}));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userEmail = (searchParams.get("email") || "").toLowerCase().trim();
  const days = Math.max(30, Number(searchParams.get("days") || 365)); // default: 1 jaar
  const maxMsgs = Math.max(20, Math.min(500, Number(searchParams.get("max") || 200)));

  if (!userEmail || !/^\S+@\S+\.\S+$/.test(userEmail)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid email" }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tok } = await sb.from("gmail_tokens")
    .select("*").eq("user_email", userEmail).maybeSingle();

  if (!tok?.access_token) {
    return NextResponse.json({ ok: false, error: "No Gmail token for this user. Connect first." }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || undefined,
    expiry_date: tok.expiry_date || undefined,
    scope: tok.scope || undefined,
    token_type: tok.token_type || undefined,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const q = `newer_than:${days}d -in:chats -in:drafts`;
  const list = await gmail.users.messages.list({
    userId: "me", q, maxResults: maxMsgs,
  });

  const ids = (list.data.messages || []).map(m => m.id!).slice(0, maxMsgs);

  const domains = new Set<string>();
  for (const id of ids) {
    const msg = await gmail.users.messages.get({
      userId: "me", id, format: "metadata", metadataHeaders: ["From","Return-Path"]
    });
    const headers = msg.data.payload?.headers || [];
    const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "";
    const ret  = headers.find(h => h.name?.toLowerCase() === "return-path")?.value || "";
    const d1 = from ? extractDomainFromFromHeader(from) : "";
    const d2 = ret  ? extractDomainFromFromHeader(ret)  : "";
    [d1,d2].forEach(d => {
      const reg = d && hostToDomain(d);
      if (reg && !IGNORE.has(reg) && reg.includes(".")) domains.add(reg);
    });
    // kleine throttle om API limits lief te hebben
    if (domains.size > 300) break;
  }

  const out: any[] = [];
  for (const d of Array.from(domains).slice(0, 150)) {
    try {
      const lr = await lookup(d);
      out.push({ domain: d, contact: lr?.contact || null, ok: !!lr?.ok });
      await new Promise(res => setTimeout(res, 150));
    } catch (e:any) {
      out.push({ domain: d, error: e?.message || "lookup failed" });
    }
  }

  return NextResponse.json({ ok: true, email: userEmail, found: out.length, results: out });
}
