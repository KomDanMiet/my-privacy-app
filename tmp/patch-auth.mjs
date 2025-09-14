// tmp/patch-debug.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const file = "app/auth/debug/route.ts";
const content = `export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = await cookies();                 // <-- Next 15: await required
  const names = store.getAll().map((c) => c.name);

  return NextResponse.json({
    path: url.pathname,
    search: Object.fromEntries(url.searchParams),
    cookieNames: names,
    hint:
      "Zoek naar sb-pkce-verifier en sb-*-auth-token. Ontbreken ze? " +
      "Dan startte je login op een andere origin dan deze callback."
  });
}
`;

mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, content);
console.log("Wrote", file, "\nDone. Now run: npm run dev");
