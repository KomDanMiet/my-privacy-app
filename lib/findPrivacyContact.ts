// lib/findPrivacyContact.ts
import * as cheerio from "cheerio";
import { getDomain } from "tldts";

const CANDIDATE_PATHS = [
  "", "privacy", "privacy-policy", "privacybeleid",
  "dataprotection", "gdpr", "legal", "contact", "about/privacy",
  "nl/nl/tc/privacybeleid"
];

function toRegistrableDomain(input: string) {
  try {
    let s = (input || "").trim().toLowerCase();
    s = s.replace(/^mailto:/, "");
    if (s.includes("@")) s = s.split("@")[1];
    if (/^https?:\/\//.test(s)) s = new URL(s).hostname;
    s = s.replace(/^www\./, "");
    const d = getDomain(s);
    return d || s;
  } catch {
    return (input || "").toLowerCase().replace(/^www\./, "");
  }
}

function abs(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

const EMAIL_RX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LOWER_SCORE = ["info@", "support@", "help@", "klantenservice@", "customerservice@"];
const BOOST_SCORE = ["dpo@", "privacy@", "data.protection@", "dataprotection@", "gegevensbescherming@", "avg@", "gdpr@"];

type Result = {
  contact_type: "email" | "form" | "none";
  value: string | null;
  confidence: number;
  meta: { tried: any[]; pages_crawled: string[] };
};

export async function findPrivacyContact(inputDomain: string): Promise<Result> {
  const domain = toRegistrableDomain(inputDomain);
  const base = `https://${domain}`;
  const tried: any[] = [];
  const pages: string[] = [];
  const emailScores = new Map<string, number>();
  const seen = new Set<string>();

  for (const path of CANDIDATE_PATHS) {
    const url = abs(base, `/${path}`.replace(/\/+$/, "") || "/");
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok || !r.headers.get("content-type")?.includes("text/html")) continue;
      const html = await r.text();
      pages.push(url);

      const $ = cheerio.load(html);

      // (1) Formulier-linken opsnorren
      let formHref: string | null = null;
      $("a[href]").each((_, el) => {
        const href = String($(el).attr("href") || "");
        const text = ($(el).text() || "").toLowerCase();
        const full = abs(url, href);

        const looksLikeForm =
          /request|verzoek|rights|rechten|data|privacy|gdpr|avg/.test(text) ||
          /request|verzoek|rights|rechten|data|privacy|gdpr|avg/i.test(href);

        if (looksLikeForm && (href.startsWith("http") || href.startsWith("/"))) {
          formHref = full;
        }
      });
      if (formHref) {
        tried.push({ contact_type: "form", value: formHref, context: "link" });
        // als we een duidelijke formulier-URL hebben, geven we die meteen terug
        return {
          contact_type: "form",
          value: formHref,
          confidence: 80,
          meta: { tried, pages_crawled: pages },
        };
      }

      // (2) E-mails uit mailto + tekst
      const candidates = new Set<string>();

      $("a[href^='mailto:']").each((_, el) => {
        const href = String($(el).attr("href") || "");
        const addr = href.replace(/^mailto:/i, "").split("?")[0].trim();
        if (addr) candidates.add(addr);
      });

      const allText = $("body").text() || "";
      (allText.match(EMAIL_RX) || []).forEach((m) => candidates.add(m));

      for (const raw of candidates) {
        const email = raw.toLowerCase();
        const host = toRegistrableDomain(email);
        // alleen e-mails op hetzelfde registrable domain scoren hoog
        let score = host === domain ? 55 : 35;

        if (LOWER_SCORE.some((p) => email.includes(p))) score -= 10;
        if (BOOST_SCORE.some((p) => email.includes(p))) score += 15;
        if (/privacy|policy|gdpr|avg|gegevens/i.test(url)) score += 10;

        const prev = emailScores.get(email) || 0;
        if (score > prev) emailScores.set(email, score);

        tried.push({ contact_type: "email", value: email, context: "inline", confidence: score });
      }
    } catch {
      // ignore fetch/parse fouten per pagina
    }
  }

  // beste e-mail kiezen
  let bestEmail: string | null = null;
  let bestScore = 0;
  for (const [e, s] of emailScores.entries()) {
    if (s > bestScore) {
      bestScore = s;
      bestEmail = e;
    }
  }

  if (bestEmail) {
    return {
      contact_type: "email",
      value: bestEmail,
      confidence: Math.max(0, Math.min(100, bestScore)),
      meta: { tried, pages_crawled: pages },
    };
  }

  return {
    contact_type: "none",
    value: null,
    confidence: 0,
    meta: { tried, pages_crawled: pages },
  };
}
