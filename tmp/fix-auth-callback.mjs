// tmp/fix-auth-callback.mjs
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname } from "node:path";

// 1) Verwijder de foute parallelle page
const badPage = "app/auth/callback/page.tsx";
if (existsSync(badPage)) {
  rmSync(badPage, { force: true });
  console.log("Removed", badPage);
}

// 2) Schrijf de juiste route handler (ASCII, geen curly quotes)
const routeFile = "app/auth/callback/route.ts";
const routeContent = `
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (!code) {
    return NextResponse.redirect(new URL(next, req.url));
  }

  const supabase = createRouteHandlerClient({ cookies });
  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch (err) {
    const dbg = new URL("/auth/debug", req.url);
    dbg.searchParams.set("err", (err && (err as Error).message) || "exchange_failed");
    return NextResponse.redirect(dbg);
  }

  return NextResponse.redirect(new URL(next, req.url));
}
`.trimStart();
mkdirSync(dirname(routeFile), { recursive: true });
writeFileSync(routeFile, routeContent, "utf8");
console.log("Wrote", routeFile);

// 3) Login page zonder template literals (minder kans op knoeiwerk)
const loginFile = "app/login/page.tsx";
const loginContent = `
"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Gebruik de huidige origin in de browser; val server-side terug op env of localhost.
const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: SITE_URL + "/auth/callback?next=/" }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign in</h1>
      <button onClick={signInWithGoogle} disabled={loading}>
        {loading ? "Redirecting..." : "Continue with Google"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p style={{ marginTop: 12 }}>
        Debug: <a href="/auth/debug" target="_blank">/auth/debug</a>
      </p>
    </main>
  );
}
`.trimStart();
mkdirSync(dirname(loginFile), { recursive: true });
writeFileSync(loginFile, loginContent, "utf8");
console.log("Wrote", loginFile);

// 4) Debug route met async cookies() (Next 15)
const debugFile = "app/auth/debug/route.ts";
const debugContent = `
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
`.trimStart();
mkdirSync(dirname(debugFile), { recursive: true });
writeFileSync(debugFile, debugContent, "utf8");
console.log("Wrote", debugFile);

console.log("\nPatch ok. Run:\n  npm run build\n  npm run dev");
