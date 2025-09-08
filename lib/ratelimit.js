// lib/ratelimit.js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
let rl = {};

// Init Redis client only if keys present
if (hasUpstash) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  rl = {
    // 5 req per minute per IP
    rlIpMinute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
    }),
    // 100 req per day per IP
    rlIpDay: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 d"),
    }),
    // 20 req per day per email
    rlEmailDay: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 d"),
    }),
    // 1 req per day per user+company
    rlUserCompanyDay: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1, "1 d"),
    }),
  };
} else {
  // Fallbacks: always "success: true"
  const dummy = {
    limit: async () => ({ success: true, reset: Date.now() + 60000 }),
  };
  rl = {
    rlIpMinute: dummy,
    rlIpDay: dummy,
    rlEmailDay: dummy,
    rlUserCompanyDay: dummy,
  };
}

// --- Helpers ---
export async function isBanned(key) {
  // Example: ban certain emails/IPs manually if needed
  // Return true/false
  return false;
}

export function rateLimitResponse({ reason, scope, reset }) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: reason || "Rate limited",
      scope: scope || null,
      reset: reset || null,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export const rlIpMinute = rl.rlIpMinute;
export const rlIpDay = rl.rlIpDay;
export const rlEmailDay = rl.rlEmailDay;
export const rlUserCompanyDay = rl.rlUserCompanyDay;