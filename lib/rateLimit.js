// lib/ratelimit.js
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Detecteer of Upstash keys aanwezig zijn
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Eén Redis client voor alle rate limiters
export const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Helper om een limiter te maken of een no-op fallback
function createLimiter(limit, windowStr) {
  if (!redis) {
    // Fallback object met compatibele .limit() response (altijd doorlaten)
    return {
      async limit() {
        const resetSec = Math.floor(Date.now() / 1000) + 60;
        return { success: true, limit, remaining: limit, reset: resetSec };
      },
    };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, windowStr),
    analytics: true,
  });
}

// Concreet: IP per minuut, IP per dag, email per dag
export const rlIpMinute = createLimiter(10, "1 m");  // bv. 10/min
export const rlIpDay    = createLimiter(200, "1 d"); // bv. 200/dag
export const rlEmailDay = createLimiter(20, "1 d");  // bv. 20/dag per email

// Optioneel: simpele banlist via Redis keys
export async function isBanned(value) {
  if (!redis) return false;
  const key =
    value.includes("@")
      ? `ban:email:${value.toLowerCase()}`
      : `ban:ip:${value}`;
  const v = await redis.get(key);
  return !!v;
}

// Gestandaardiseerde 429 response met headers
export function rateLimitResponse({ reason = "rate_limited", reset, limit = 0, remaining = 0 }) {
  const hdrs = new Headers();
  if (reset) hdrs.set("X-RateLimit-Reset", String(reset));
  hdrs.set("X-RateLimit-Limit", String(limit));
  hdrs.set("X-RateLimit-Remaining", String(remaining));
  return new NextResponse(
    JSON.stringify({ ok: false, error: reason }),
    { status: 429, headers: hdrs }
  );
}