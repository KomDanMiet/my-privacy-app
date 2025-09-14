export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = await cookies(); // Next 15: await verplicht
  const names = store.getAll().map((c) => c.name);
  return NextResponse.json({
    path: url.pathname,
    search: Object.fromEntries(url.searchParams),
    cookieNames: names,
    hint:
      "Zoek naar sb-pkce-verifier en sb-*-auth-token. Ontbreken ze? Login en callback komen niet van dezelfde origin."
  });
}
