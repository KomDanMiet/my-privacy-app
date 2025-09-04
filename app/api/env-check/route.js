// app/api/env-check/route.js
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    SUPABASE_URL: process.env.SUPABASE_URL ? "✅ set" : "❌ missing",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ set" : "❌ missing",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ set" : "❌ missing",
    RESEND_FROM: process.env.RESEND_FROM || "❌ missing",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "❌ missing",
  });
}