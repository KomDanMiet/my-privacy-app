// app/api/verify/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { setSessionCookie } from '@/lib/session';

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 });
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: row, error } = await supabase
    .from('verify_tokens')
    .select('email, expires_at, subscribers!inner(full_name)')
    .eq('token', token)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 });
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'Token expired' }, { status: 400 });
  }

  // Markeer als verified
  await supabase
    .from('subscribers')
    .update({ verified_at: new Date().toISOString() })
    .eq('email', row.email);

  // Token opruimen
  await supabase.from('verify_tokens').delete().eq('token', token);

  // ✅ Sessie-cookie zetten
  setSessionCookie({ email: row.email, name: row.subscribers?.full_name ?? null });

  // Redirect naar results (zonder dat user opnieuw iets hoeft te doen)
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://my-privacy-app.vercel.app';
  return NextResponse.redirect(`${base}/results`);
}
