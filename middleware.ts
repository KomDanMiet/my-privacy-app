// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(_req: NextRequest) {
  // Do nothing; just continue
  return NextResponse.next();
}

// Optional: scope what paths run middleware
export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};