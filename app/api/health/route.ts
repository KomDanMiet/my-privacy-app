export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
const checks = {
node: process.version,
env: process.env.NODE_ENV,
xaiApiKey: Boolean(process.env.XAI_API_KEY),
supabaseUrl: Boolean(process.env.SUPABASE_URL)
};

const ok = checks.supabaseUrl && checks.xaiApiKey;
return NextResponse.json({ ok, checks }, { status: ok ? 200 : 500 });
}