// app/api/gmail/scan/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/supabase";
import { getSupabaseInRoute } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ----- Service-role client for DB writes (never expose to client) -----
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient<Database>(SUPABASE_URL, SERVICE_KEY);

// Gmail endpoints
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";

type GoogleToken = {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number; // ms epoch
  expires_in?: number;  // seconds (fresh refresh)
};

export async function POST() {
  const res = NextResponse.json({ ok: true }); // we'll overwrite body later if needed
  try {
    // SSR Supabase bound to request/response cookies (so refresh tokens can be set)
    const supaSSR = await getSupabaseInRoute(res);

    // ---- get the authenticated user ----
    const {
      data: { user },
      error: userErr,
    } = await supaSSR.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    // ---- load Gmail token from DB ----
    const { data: tok, error: tokErr } = await sb
      .from("gmail_tokens")
      .select("email, token_json")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokErr || !tok) {
      return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
    }

    const token = (tok.token_json ?? null) as GoogleToken | null;
    if (!token?.access_token) {
      return NextResponse.json({ error: "No access_token in token_json" }, { status: 401 });
    }

    let accessToken = token.access_token;

    // ---- helpers ----
    const doGmail = async (url: string, init: RequestInit, attempt = 0): Promise<Response> => {
      const r = await fetch(url, init);
      if (r.status === 429 || r.status >= 500) {
        if (attempt >= 3) return r;
        const retryAfter =
          Number(r.headers.get("retry-after")) || Math.min(2 ** attempt * 300, 2000);
        await new Promise((ok) => setTimeout(ok, retryAfter));
        return doGmail(url, init, attempt + 1);
      }
      return r;
    };

    const tryRefresh = async () => {
      if (!token?.refresh_token) return false;

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      });

      const r = await fetch(OAUTH_TOKEN, { method: "POST", body });
      const j = await r.json();
      if (!r.ok || !j?.access_token) return false;

      accessToken = j.access_token as string;

      const nextToken: GoogleToken = {
        ...token,
        access_token: j.access_token,
        expiry_date:
          typeof j.expires_in === "number" ? Date.now() + j.expires_in * 1000 : token.expiry_date,
      };

      await sb.from("gmail_tokens").update({ token_json: nextToken as any }).eq("user_id", userId);
      return true;
    };

    // Refresh if near expiry
    const msLeft =
      typeof token.expiry_date === "number"
        ? token.expiry_date - Date.now()
        : Number.POSITIVE_INFINITY;
    if (msLeft < 30_000) await tryRefresh();

    const nowIso = new Date().toISOString();
    const domains: string[] = [];
    let scannedCount = 0;

    const authHeaders = (t: string) => ({ Authorization: `Bearer ${t}` });
    const extractDomain = (fromValue = ""): string | null => {
      const m = fromValue.toLowerCase().match(/[^\s<@"']+@([^\s>@"']+)/);
      if (!m) return null;
      const d = m[1].trim().replace(/^www\./, "");
      if (["gmail.com", "googlemail.com", "smtp.gmail.com"].includes(d)) return null;
      return d;
    };

    // ---- scan via query ----
    const q = "-SPAM -TRASH";
    let pageToken: string | undefined;

    do {
      const listUrl = new URL(`${GMAIL_BASE}/users/me/messages`);
      listUrl.searchParams.set("q", q);
      listUrl.searchParams.set("maxResults", "500");
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);
      listUrl.searchParams.set("fields", "messages/id,nextPageToken");

      let r = await doGmail(listUrl.toString(), { headers: authHeaders(accessToken) });
      if (r.status === 401 && (await tryRefresh())) {
        r = await doGmail(listUrl.toString(), { headers: authHeaders(accessToken) });
      }
      if (!r.ok) break;

      const j = (await r.json()) as { messages?: { id: string }[]; nextPageToken?: string };
      const ids = j.messages?.map((m) => m.id) ?? [];
      pageToken = j.nextPageToken;

      for (const id of ids) {
        const msgUrl = new URL(`${GMAIL_BASE}/users/me/messages/${id}`);
        msgUrl.searchParams.set("format", "metadata");
        msgUrl.searchParams.set("metadataHeaders", "From");
        msgUrl.searchParams.set("fields", "id,payload/headers");

        let r2 = await doGmail(msgUrl.toString(), { headers: authHeaders(accessToken) });
        if (r2.status === 401 && (await tryRefresh())) {
          r2 = await doGmail(msgUrl.toString(), { headers: authHeaders(accessToken) });
        }
        if (!r2.ok) continue;

        const msg = (await r2.json()) as any;
        const from = msg?.payload?.headers?.find((h: any) => h.name === "From")?.value || "";
        const d = extractDomain(from);
        if (d) domains.push(d);
        scannedCount++;
      }
    } while (pageToken);

    // ---- upsert discovered domains ----
    type DSInsert = TablesInsert<"discovered_senders">;
    const unique = Array.from(new Set(domains));

    if (unique.length) {
      const rows: DSInsert[] = unique.map((d) => ({
        user_id: userId,
        email: tok.email,
        domain: d,
        source: "gmail",
        last_seen: nowIso,
      }));

      await sb.from("discovered_senders").upsert(rows, { onConflict: "user_id,domain" });
    }

    // ---- update scan meta (optional) ----
    await sb
      .from("gmail_scan_meta")
      .upsert(
        {
          user_id: userId,
          scanned_at: nowIso,
          last_count: scannedCount,
          last_unique_domains: unique.length,
        } as any,
        { onConflict: "user_id" }
      );

    return NextResponse.json({
      ok: true,
      scanned_at: nowIso,
      scanned_count: scannedCount,
      unique_domains: unique.length,
      sample_domains: unique.slice(0, 10),
    });
  } catch (e: any) {
    console.error("scan error:", e);
    return NextResponse.json(
      { error: e?.message || "Scan failed" },
      { status: 500 }
    );
  }
}