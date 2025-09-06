// lib/rateLimit.js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Fallback voor lokaal (zonder Upstash env)
const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// 1) Globale limiter (per IP): 5 requests / 10s burst, 100/24h
export const rlIP = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "10 s"),
      analytics: true,
      prefix: "rl:ip",
    })
  : null;

// 2) Per-email limiter (bijv. DSAR/subscribe): 3 per 10 min, 20 per dag
export const rlEmail = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      analytics: true,
      prefix: "rl:email",
    })
  : null;

// Simpele in-memory fallback (alleen voor dev)
const mem = new Map();
function memoryLimit(key, limit = 5, windowMs = 10_000) {
  const now = Date.now();
  const b = mem.get(key)?.filter(t => now - t < windowMs) || [];
  b.push(now);
  mem.set(key, b);
  const remaining = Math.max(0, limit - b.length);
  const reset = windowMs - (now - b[0]);
  return { success: b.length <= limit, remaining, reset };
}

export async function limitByIP(req, limit = 5, window = "10 s") {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";
  const key = `ip:${ip}`;
  if (rlIP) {
    const { success, reset, remaining } = await rlIP.limit(key);
    return { success, reset, remaining, key };
  }
  const r = memoryLimit(key, limit, 10_000);
  return { success: r.success, reset: r.reset, remaining: r.remaining, key };
}

export async function limitByEmail(email, limit = 3, window = "10 m") {
  const key = `email:${(email || "").toLowerCase()}`;
  if (!key.includes(":")) return { success: false, reset: 0, remaining: 0, key }; // no email
  if (rlEmail) {
    const { success, reset, remaining } = await rlEmail.limit(key);
    return { success, reset, remaining, key };
  }
  const r = memoryLimit(key, limit, 10 * 60_000);
  return { success: r.success, reset: r.reset, remaining: r.remaining, key };
}