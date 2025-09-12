// app/api/gmail/scan/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type GmailTokens = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: string | null;             // ISO string
  provider_account_id: string;            // Gmail userId
  revoked: boolean | null;
  last_history_id: string | null;         // for delta scans
};

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";

export async function POST(req: Request) {
  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // 1) Load tokens (NO generic on .from)
  const { data: tokRaw, error: tokErr } = await sb
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", userId)
    .or("revoked.is.null,revoked.eq.false") // handle null or false
    .maybeSingle();

  const tok = tokRaw as GmailTokens | null;

  if (tokErr || !tok) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Helper: backoff for transient errors
  const doGmail = async (url: string, init: RequestInit, attempt = 0): Promise<Response> => {
    const res = await fetch(url, init);
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after")) || Math.min(2 ** attempt * 300, 2000);
      await new Promise((r) => setTimeout(r, retryAfter));
      return doGmail(url, init, attempt + 1);
    }
    return res;
  };

  // 2) Ensure valid access token (simple time check)
  let accessToken = tok.access_token;
  const isExpired = tok.expiry_date && Date.parse(tok.expiry_date) - Date.now() < 30_000;

  const refreshOnce = async () => {
    if (!tok.refresh_token) return { error: "no_refresh_token" as const };

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    });

    const r = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const j = await r.json().catch(() => ({} as any));
    if (!r.ok) {
      // Mark revoked on invalid_grant
      if (j?.error === "invalid_grant") {
        await sb.from("gmail_tokens").update({ revoked: true }).eq("id", tok.id);
        return { error: "invalid_grant" as const };
      }
      return { error: "refresh_failed" as const };
    }

    const newExpiry = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
    const { error: upErr } = await sb
      .from("gmail_tokens")
      .update({
        access_token: j.access_token,
        expiry_date: newExpiry,
        revoked: false,
      })
      .eq("id", tok.id);

    if (upErr) return { error: "token_update_failed" as const };

    accessToken = j.access_token as string;
    return { ok: true as const };
  };

  if (isExpired) {
    const rr = await refreshOnce();
    if (rr && "error" in rr) {
      const code =
        rr.error === "invalid_grant" ? 401 :
        rr.error === "no_refresh_token" ? 400 :
        500;
      return NextResponse.json({ error: rr.error }, { status: code });
    }
  }

  // 3) Determine scan window
  const { data: scanMeta } = await sb
    .from("gmail_scan_meta")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const lastScanAt = scanMeta?.scanned_at ? new Date(scanMeta.scanned_at) : null;
  const afterQuery = lastScanAt ? ` after:${Math.floor(lastScanAt.getTime() / 1000)}` : "";
  const q = `-SPAM -TRASH${afterQuery}`.trim();

  const useHistory = Boolean(tok.last_history_id);
  let domains: string[] = [];
  let scannedCount = 0;
  let newLastHistoryId: string | null = null;

  const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

  const extractDomain = (fromValue = ""): string | null => {
    const m = fromValue.toLowerCase().match(/[^\s<@"']+@([^\s>@"']+)/);
    if (!m) return null;
    let d = m[1].trim().replace(/^www\./, "");
    if (["gmail.com", "googlemail.com", "smtp.gmail.com"].includes(d)) return null;
    return d;
  };

  // --- A) History-based delta ---
  const scanViaHistory = async () => {
    let pageToken: string | undefined;
    let historyId = tok.last_history_id!;
    do {
      const url = new URL(`${GMAIL_BASE}/users/me/history`);
      url.searchParams.set("startHistoryId", historyId);
      url.searchParams.set("historyTypes", "messageAdded");
      url.searchParams.set("maxResults", "500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      url.searchParams.set("fields", "history(id,messagesAdded(message(id))),historyId,nextPageToken");

      let res = await doGmail(url.toString(), { headers: authHeaders(accessToken) });
      if (res.status === 401) {
        const rr = await refreshOnce();
        if (rr && "error" in rr) return { error: "auth_failed" as const };
        res = await doGmail(url.toString(), { headers: authHeaders(accessToken) });
      }
      if (!res.ok) return { error: `history_${res.status}` as const };

      const j = await res.json();
      const ids: string[] =
        j?.history?.flatMap((h: any) => h.messagesAdded?.map((m: any) => m.message.id) ?? []) ?? [];
      newLastHistoryId = j?.historyId || newLastHistoryId;

      for (const id of ids) {
        const gUrl = new URL(`${GMAIL_BASE}/users/me/messages/${id}`);
        gUrl.searchParams.set("format", "metadata");
        gUrl.searchParams.set("metadataHeaders", "From");
        gUrl.searchParams.set("fields", "id,payload/headers");
        let r = await doGmail(gUrl.toString(), { headers: authHeaders(accessToken) });
        if (r.status === 401) {
          const rr = await refreshOnce();
          if (rr && "error" in rr) return { error: "auth_failed" as const };
          r = await doGmail(gUrl.toString(), { headers: authHeaders(accessToken) });
        }
        if (!r.ok) continue;
        const msg = await r.json();
        const from = msg?.payload?.headers?.find((h: any) => h.name === "From")?.value || "";
        const d = extractDomain(from);
        if (d) domains.push(d);
        scannedCount++;
      }

      pageToken = j?.nextPageToken;
    } while (pageToken);

    return { ok: true as const };
  };

  // --- B) Query-based list ---
  const scanViaQuery = async () => {
    let pageToken: string | undefined;
    do {
      const url = new URL(`${GMAIL_BASE}/users/me/messages`);
      url.searchParams.set("q", q);
      url.searchParams.set("maxResults", "500");
      url.searchParams.set("fields", "messages/id,nextPageToken");

      if (pageToken) url.searchParams.set("pageToken", pageToken);

      let res = await doGmail(url.toString(), { headers: authHeaders(accessToken) });
      if (res.status === 401) {
        const rr = await refreshOnce();
        if (rr && "error" in rr) return { error: "auth_failed" as const };
        res = await doGmail(url.toString(), { headers: authHeaders(accessToken) });
      }
      if (!res.ok) return { error: `list_${res.status}` as const };

      const j = await res.json();
      const ids: string[] = j?.messages?.map((m: any) => m.id) ?? [];
      pageToken = j?.nextPageToken;

      for (const id of ids) {
        const gUrl = new URL(`${GMAIL_BASE}/users/me/messages/${id}`);
        gUrl.searchParams.set("format", "metadata");
        gUrl.searchParams.set("metadataHeaders", "From");
        gUrl.searchParams.set("fields", "id,payload/headers,historyId");
        const r = await doGmail(gUrl.toString(), { headers: authHeaders(accessToken) });
        if (!r.ok) continue;
        const msg = await r.json();
        const from = msg?.payload?.headers?.find((h: any) => h.name === "From")?.value || "";
        const d = extractDomain(from);
        if (d) domains.push(d);
        scannedCount++;
        const h = msg?.historyId;
        if (h && (!newLastHistoryId || BigInt(h) > BigInt(newLastHistoryId))) newLastHistoryId = String(h);
      }
    } while (pageToken);

    return { ok: true as const };
  };

  const scanRes = useHistory ? await scanViaHistory() : await scanViaQuery();
  if (scanRes && "error" in scanRes) {
    return NextResponse.json({ error: scanRes.error }, { status: 502 });
  }

  // 4) Upsert domains → jouw kolommen (last_seen + source)
  const unique = Array.from(new Set(domains.map((d) => d.toLowerCase())));
  if (unique.length) {
    const rows = unique.map((d) => ({
      user_id: userId,
      domain: d,
      source: "gmail",
      last_seen: nowIso, // jouw schema
    }));
    await sb.from("discovered_senders").upsert(rows, {
      onConflict: "user_id,domain",
      ignoreDuplicates: false,
    });
  }

  // 5) Update scan metadata + last_history_id
  await sb
    .from("gmail_scan_meta")
    .upsert(
      {
        user_id: userId,
        scanned_at: nowIso,
        last_count: scannedCount,
        last_unique_domains: unique.length,
      },
      { onConflict: "user_id" }
    );

  if (newLastHistoryId) {
    await sb.from("gmail_tokens").update({ last_history_id: newLastHistoryId }).eq("id", tok.id);
  }

  return NextResponse.json({
    ok: true,
    scanned_at: nowIso,
    scanned_count: scannedCount,
    unique_domains: unique.length,
    sample_domains: unique.slice(0, 10),
  });
}