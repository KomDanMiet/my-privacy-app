// app/api/env-check/route.js
export async function GET() {
  return new Response(
    JSON.stringify({
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing',
      RESEND_FROM: process.env.RESEND_FROM || null
    }, null, 2),
    { headers: { 'content-type': 'application/json' } }
  );
}