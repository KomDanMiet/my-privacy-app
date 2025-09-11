// app/api/gmail/scan/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------- Supabase ---------- */
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

/* ---------- helpers ---------- */
function extractDomain(fromValue = ""): string | null {
  // e.g. "Amazon <no-reply@amazon.nl>" -> "amazon.nl"
  const m = fromValue.toLowerCase().match(/[^\s<@"']+@([^\s>@"']+)/);
  if (!m) return null;
  let d = m[1].trim().replace(/^www\./, "");
  if (["gmail.com", "googlemail.com", "smtp.gmail.com"].includes(d)) return null;
  return d;
}

async function refreshToken(tokenJson: any) {
  if (!tokenJson?.refresh_token) return tokenJson;

  const params = new URLSearchParams();
  params.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  params.set("client_secret", process.env.GOOGLE_CLIENT_SECRET!);
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", tokenJson.refresh_token);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.warn("[scan] refresh token failed:", r.status, t);
    return tokenJson;
  }

  const j = await r.json();
  return {
    ...tokenJson,
    access_token: j.access_token,
    token_type: j.token_type || tokenJson.token_type || "Bearer",
    scope: j.scope || tokenJson.scope,
    expires_in: j.expires_in,
    // compute absolute expiry
    expiry_date:
      j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : tokenJson.expiry_date,
  };
}

async function gmailListMessages(accessToken: string, q: string, max = 500) {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < max) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("q", q);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`gmail list failed ${r.status}: ${t}`);
    }

    const j = await r.json();
    (j.messages || []).forEach((m: any) => ids.push(m.id));
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return ids.slice(0, max);
}

async function gmailGetFromHeader(accessToken: string, id: string) {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
    `?format=metadata&metadataHeaders=From&metadataHeaders=Return-Path`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;

  const j = await r.json();
  const headers: Array<{ name: string; value: string }> = j?.payload?.headers || [];
  const from =
    headers.find((h) => h.name.toLowerCase() === "from")?.value ||
    headers.find((h) => h.name.toLowerCase() === "return-path")?.value ||
    "";
  return from;
}

/* ---------- route ---------- */

// used inside the retry wrapper to persist post-refresh tokens
let currentEmailForRefresh: string | null = null;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").toLowerCase().trim();
    const days = Math.max(7, Math.min(3650, Number(body.days ?? 365))); // default: 1 year
    const hardCap = Math.max(50, Math.min(2000, Number(body.max ?? 800)));

    if (!email) {
      return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });
    }
    currentEmailForRefresh = email;

    // 1) load token
    const { data: tokRow, error: tokErr } = await sb
      .from("gmail_tokens")
      .select("token_json")
      .eq("email", email)
      .maybeSingle();

    if (tokErr) throw tokErr;
    if (!tokRow?.token_json) {
      return NextResponse.json({ ok: false, error: "no token for this email" }, { status: 404 });
    }

    let tokenJson =
      typeof tokRow.token_json === "string" ? JSON.parse(tokRow.token_json) : tokRow.token_json;

    // 2) refresh if **missing** or **expired**
    const expiredOrMissing =
      !tokenJson?.access_token ||
      !tokenJson?.expiry_date ||
      Number(tokenJson.expiry_date) < Date.now() - 30_000;

    if (expiredOrMissing) {
      tokenJson = await refreshToken(tokenJson);
      await sb
        .from("gmail_tokens")
        .update({ token_json: tokenJson, updated_at: new Date().toISOString() })
        .eq("email", email);
    }

    let access = tokenJson?.access_token;
    if (!access) {
      return NextResponse.json({ ok: false, error: "no usable access_token" }, { status: 401 });
    }

    // 3) list recent messages with **auto refresh on 401 once**
    const q = `newer_than:${Math.ceil(days / 30)}m`; // coarse: past N months
    let ids: string[];
    try {
      ids = await gmailListMessages(access, q, hardCap);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
        // refresh then retry once
        tokenJson = await refreshToken(tokenJson);
        await sb
          .from("gmail_tokens")
          .update({ token_json: tokenJson, updated_at: new Date().toISOString() })
          .eq("email", email);
        access = tokenJson?.access_token;
        if (!access) throw e;
        ids = await gmailListMessages(access, q, hardCap);
      } else {
        throw e;
      }
    }

    // 4) fetch headers and count domains
    const domainCounts = new Map<string, number>();
    let fetched = 0;

    for (const id of ids) {
      const fromVal = await gmailGetFromHeader(access!, id);
      if (!fromVal) continue;
      const d = extractDomain(fromVal);
      if (!d) continue;
      domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
      fetched++;
    }

    const nowIso = new Date().toISOString();

    // 5) upsert into discovered_senders
    if (domainCounts.size) {
      const rows = Array.from(domainCounts.entries()).map(([domain, count]) => ({
        email,
        domain,
        count,
        last_seen: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      // requires a unique constraint on (email, domain)
      const { error: upErr } = await sb
        .from("discovered_senders")
        .upsert(rows, { onConflict: "email,domain" });

      if (upErr) throw upErr;
    }

    // 6) mark scanned_at to end auto loops
    await sb.from("gmail_tokens").update({ scanned_at: nowIso, updated_at: nowIso }).eq("email", email);

    return NextResponse.json({
      ok: true,
      email,
      scanned: fetched,
      uniqueDomains: domainCounts.size,
      sample: Array.from(domainCounts.keys()).slice(0, 12),
    });
  } catch (e: any) {
    console.error("[/api/gmail/scan] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "scan failed" }, { status: 500 });
  } finally {
    currentEmailForRefresh = null;
  }
}