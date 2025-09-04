// app/api/resend-check/route.js
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    RESEND_FROM: process.env.RESEND_FROM || null,
    hasKey: !!process.env.RESEND_API_KEY,
  });
}
