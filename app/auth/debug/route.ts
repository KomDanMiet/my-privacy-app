export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const names = cookies().getAll().map((c) => c.name);
  return NextResponse.json({
    path: url.pathname,
    search: Object.fromEntries(url.searchParams),
    cookieNames: names,
    hint:
      "Zoek naar sb-pkce-verifier en sb-*-auth-token. Ontbreken die? " +
      "Dan is de login niet vanaf dezelfde origin gestart als deze callback."
  });
}
