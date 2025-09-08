// lib/csrf.js
/**
 * Dummy CSRF checker.
 * In de toekomst kun je hier een echte check bouwen
 * (bijv. HMAC of Origin header).
 */
export function csrfOk(req) {
  // Optie 1: altijd accepteren
  return true;

  // Optie 2: check Origin (extra bescherming)
  /*
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return origin === allowed;
  */
}