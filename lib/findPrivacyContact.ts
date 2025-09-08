// lib/findPrivacyContact.ts
import { load } from "cheerio";
import { parse as parseDomain } from "tldts";

/** ---- Config ---- */
const CANDIDATE_PATHS = [
  "", "privacy", "privacy-policy", "privacybeleid", "dataprotection",
  "gdpr", "legal", "contact", "about/privacy"
];

const KEYWORDS = [
  "dpo","privacy","data protection","gdpr","datenschutz","avg","persoonlijke gegevens",
  "data protection officer","data privacy","dataprivacy","gegevensbescherming"
];

// E-mail regex: match e-mailadres en zorg dat er geen letter/cijfer direct ná volgt
const EMAIL_REGEX = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})(?![a-z0-9])/gi;

/** ---- Helpers ---- */
function baseDomainOf(host: string) {
  const p = parseDomain(host);
  return p.domain || host;
}

function emailDomain(e: string) {
  return e.split("@")[1]?.toLowerCase() ?? "";
}

function cleanEmail(raw: string) {
  let e = raw.replace(/^mailto:/i, "").trim();
  // strip trailing punctuation/spacers
  e = e.replace(/[.,;:)\]\}>"']+$/g, "");
  return e;
}

let currentTargetBaseDomain = "";
function scoreEmail(email: string, ctx: string) {
  let score = 10;
  const e = email.toLowerCase();
  if (e.includes("dpo")) score += 50;
  if (e.includes("privacy")) score += 30;
  if (e.includes("dataprotection") || e.includes("data-protection")) score += 25;
  if (e.startsWith("no-reply") || e.startsWith("noreply")) score -= 20;
  const lowCtx = (ctx || "").toLowerCase();
  if (KEYWORDS.some(k => lowCtx.includes(k))) score += 10;

  // Domein-uitlijning boost
  const ed = emailDomain(e);
  if (currentTargetBaseDomain && ed.endsWith(currentTargetBaseDomain)) score += 15;

  return Math.max(0, Math.min(100, score));
}

function scoreForm(ctx: string) {
  let score = 20;
  const low = (ctx || "").toLowerCase();
  if (KEYWORDS.some(k => low.includes(k))) score += 30;
  return Math.max(0, Math.min(100, score));
}

function toAbsolute(base: string, href?: string | null) {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
}

async function fetchHTML(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** Vind mailto’s, inline e-mails en privacyrelevante formulieren op een pagina */
function extractFromHtml(html: string, baseUrl: string) {
  const $ = load(html);
  type Finding = { contact_type: "email" | "form"; value: string; confidence: number; context?: string };
  const findings: Finding[] = [];

  // 1) mailto-links
  $('a[href^="mailto:"]').each((_, a) => {
    const href = $(a).attr("href") || "";
    const email = cleanEmail(href);
    const ctx = ($(a).text() || $(a).parent().text() || "").slice(0, 200);
    findings.push({ contact_type: "email", value: email, confidence: scoreEmail(email, ctx), context: ctx });
  });

  // 2) inline e-mails in tekst
  const bodyText = $("body").text() || "";
  const matches = [...bodyText.matchAll(EMAIL_REGEX)];
  for (const m of matches) {
    const email = cleanEmail(m[1]);
    findings.push({ contact_type: "email", value: email, confidence: scoreEmail(email, bodyText.slice(0, 500)), context: "inline" });
  }

  // 3) formulieren met privacy-context
  $("form").each((_, f) => {
    const action = $(f).attr("action") || baseUrl;
    const url = toAbsolute(baseUrl, action) || baseUrl;
    const ctx = ($(f).closest("section,article,div").text() || "").slice(0, 400);
    const conf = scoreForm(ctx);
    if (conf >= 40) findings.push({ contact_type: "form", value: url, confidence: conf, context: ctx });
  });

  // 4) candidate links (alleen privacyrelevante) voor beperkte BFS
  const nextLinks = new Set<string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    const abs = toAbsolute(baseUrl, href || "");
    if (!abs) return;
    const txt = ($(a).text() || "").toLowerCase();
    if (KEYWORDS.some(k => txt.includes(k))) nextLinks.add(abs);
    if (/\b(privacy|gdpr|data|contact|legal|gegevens)\b/i.test(abs)) nextLinks.add(abs);
  });

  return { findings, nextLinks: Array.from(nextLinks).slice(0, 15) };
}

/** ---- Publieke API ---- */
export async function findPrivacyContact(domain: string) {
  const normalized = domain.replace(/^https?:\/\//, "").replace(/\/.*/, "");
  const base = `https://${normalized}`;
  currentTargetBaseDomain = baseDomainOf(normalized);

  const visited = new Set<string>();
  let best: { contact_type: "email" | "form" | "none"; value: string | null; confidence: number } = {
    contact_type: "none",
    value: null,
    confidence: 0,
  };
  const tried: Array<{ contact_type: "email" | "form"; value: string; confidence: number; context?: string }> = [];

  // seeds
  const seeds = CANDIDATE_PATHS.map(p => (p ? `${base}/${p}` : base));
  const queue: string[] = [...new Set(seeds)];

  // BFS met limieten
  while (queue.length && visited.size < 12) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const html = await fetchHTML(url);
      const { findings, nextLinks } = extractFromHtml(html, url);

      // Filter e-mails naar target base domain (subdomeinen toegestaan)
      const filtered = findings.filter(f => {
        if (f.contact_type !== "email") return true; // formulieren laten door
        const ed = emailDomain(f.value);
        const eBase = baseDomainOf(ed);
        return ed.endsWith(currentTargetBaseDomain) || eBase === currentTargetBaseDomain;
      });

      for (const f of filtered) {
        // normaliseer email nogmaals
        const v = f.contact_type === "email" ? cleanEmail(f.value) : f.value;
        const item = { ...f, value: v };
        tried.push(item);
        if (item.confidence > best.confidence) {
          best = { contact_type: item.contact_type, value: item.value, confidence: item.confidence };
        }
      }

      // diepte 1: alleen vanaf seed-pagina’s linken
      if (seeds.includes(url)) {
        for (const n of nextLinks) if (!visited.has(n)) queue.push(n);
      }

      if (best.confidence >= 70) break; // sterke hit, klaar
    } catch {
      // negeer fetch/parsing errors
    }
  }

  // laatste opschoningsstap
  if (best.contact_type === "email" && typeof best.value === "string") {
    best.value = cleanEmail(best.value);
  }

  return {
    contact_type: best.contact_type,
    value: best.value,
    confidence: best.confidence,
    meta: {
      tried,
      pages_crawled: Array.from(visited),
    },
  };
}
