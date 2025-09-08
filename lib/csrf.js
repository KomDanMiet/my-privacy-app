// lib/csrf.js
export function csrfOk(req) {
  try {
    const origin  = req.headers.get("origin") || "";
    const referer = req.headers.get("referer") || "";
    const host    = req.headers.get("host") || "";

    const allowed = (urlStr) => {
      if (!urlStr) return false;
      const u = new URL(urlStr);
      const h = u.hostname;
      return (
        h === host ||
        (h.endsWith(".vercel.app") && host.endsWith(".vercel.app")) ||
        h === "discodruif.com" ||
        h === "www.discodruif.com"
      );
    };

    // geen origin/referer (b.v. curl) → laat toe
    if (!origin && !referer) return true;

    return allowed(origin) || allowed(referer);
  } catch {
    return false;
  }
}