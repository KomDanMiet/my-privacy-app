import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "session";

function getSecret() {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET missing");
  return new TextEncoder().encode(s);
}

export async function createSession({ email, name }) {
  const token = await new SignJWT({ email, name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readSession() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload; // { email, name, iat, exp }
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

/* ✅ Backwards-compatible aliassen */
export const setSessionCookie = createSession;
export const getSessionFromCookies = readSession;