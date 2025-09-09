export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  try {
    const email =
      new URL(req.url).searchParams.get("email")?.toLowerCase().trim() || "";
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Missing email" },
        { status: 400, headers: noStore }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb
      .from("gmail_tokens")
      .select("expires_at, scope, updated_at")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: noStore }
      );
    }

    const expiresAtMs = data?.expires_at
      ? new Date(data.expires_at).getTime()
      : null;
    const now = Date.now();
    const hasToken = !!data;
    const isFresh =
      hasToken && !!expiresAtMs ? expiresAtMs > now + 60_000 : hasToken;

    return NextResponse.json(
      {
        ok: true,
        hasToken,
        isFresh,
        expires_at: data?.expires_at ?? null,
        scope: data?.scope ?? null,
        updated_at: data?.updated_at ?? null,
      },
      { headers: noStore }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal error" },
      { status: 500, headers: noStore }
    );
  }
}