export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export async function GET() {
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  return NextResponse.json({ version: pkg.version });
}
