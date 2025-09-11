export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function extractDomain(fromValue = ""): string | null {
  const m = fromValue.toLowerCase().match(/[^\s<@"']+@([^\s>@"']+)/);
  if (!m) return null;
  let d = m[1].trim().replace(/^www\./, "");
  if (["gmail.com", "googlemail.com", "smtp.gmail.com"].includes(d)) return null;
  return d;
}

async function refreshToken(tokenJson: any) {
  if (!tokenJson?.refresh_token) return tokenJson;
  try {
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

    if (!r.ok) return tokenJson;
    const j = await r.json();

    return {
      ...tokenJson,
      access_token: j.access_token,
      token_type: j.token_type || tokenJson.token_type || "Bearer",
      scope: j.scope || tokenJson.scope,
      expires_in: j.expires_in,
      expiry_date: j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : tokenJson.expiry_date,
    };
  } catch {
    return tokenJson;
  }
}

async function gmailListMessages(accessToken: string, q: string, max = 300) {
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
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Return-Path`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  const j = await r.json();
  const headers: Array<{ name: string; value: string }> = j?.payload?.headers || [];
  const from = headers.find(h => h.name.toLowerCase() === "from")?.value
            || headers.find(h => h.name.toLowerCase() === "return-path")?.value
            || "";
  return from;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const days = Math.max(7, Math.min(3650, Number(body.days ?? 365))); // default 1y
  const hardCap = Math.max(50, Math.min(1000, Number(body.max ?? 300))); // default 300

  if (!email) {
    return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });
  }

  // Optional: prevent overlapping scans
  try {
    const { data: row } = await sb.from("gmail_tokens").select("scanning").eq("email", email).maybeSingle();
    if (row?.scanning) {
      return NextResponse.json({ ok: true, skipped: true, reason: "already_scanning" });
    }
    await sb.from("gmail_tokens").update({ scanning: true }).eq("email", email);
  } catch {}

  try {
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

    // 2) refresh if needed
    const isExpired = tokenJson?.expiry_date && Number(tokenJson.expiry_date) < Date.now() - 30_000;
    if (!tokenJson?.access_token || isExpired) {
      tokenJson = await refreshToken(tokenJson);
      await sb
        .from("gmail_tokens")
        .update({ token_json: tokenJson, updated_at: new Date().toISOString() })
        .eq("email", email);
    }

    const access = tokenJson?.access_token;
    if (!access) {
      return NextResponse.json({ ok: false, error: "no usable access_token" }, { status: 401 });
    }

    // 3) list & fetch with small concurrency
    const q = `newer_than:${Math.ceil(days / 30)}m`;
    const ids = await gmailListMessages(access, q, hardCap);

    const domainCounts = new Map<string, number>();
    let fetched = 0;

    const CONCURRENCY = 10;
    let i = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }).map(async () => {
        while (i < ids.length) {
          const id = ids[i++];
          const fromVal = await gmailGetFromHeader(access, id);
          if (!fromVal) continue;
          const d = extractDomain(fromVal);
          if (!d) continue;
          domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
          fetched++;
        }
      })
    );

    const nowIso = new Date().toISOString();

    if (domainCounts.size) {
      const rows = Array.from(domainCounts.entries()).map(([domain, count]) => ({
        email,
        domain,
        count,
        last_seen: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: upErr } = await sb
        .from("discovered_senders")
        .upsert(rows, { onConflict: "email,domain" });

      if (upErr) throw upErr;
    }

    await sb.from("gmail_tokens").update({ scanned_at: nowIso, updated_at: nowIso, scanning: false }).eq("email", email);

    return NextResponse.json({
      ok: true,
      email,
      scanned: fetched,
      uniqueDomains: domainCounts.size,
      sample: Array.from(domainCounts.keys()).slice(0, 10),
    });
  } catch (e: any) {
    // clear scanning flag even on error
    await sb.from("gmail_tokens").update({ scanning: false }).eq("email", email);
    return NextResponse.json({ ok: false, error: e?.message || "scan failed" }, { status: 500 });
  }
}