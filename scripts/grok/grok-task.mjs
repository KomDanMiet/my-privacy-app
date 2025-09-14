import fs from "node:fs";
import path from "node:path";

const XAI_API_KEY = process.env.XAI_API_KEY;
if (!XAI_API_KEY) { console.error("Missing XAI_API_KEY"); process.exit(1); }

const CANDIDATE_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.mjs",
  "vercel.json",
  "app/api/health/route.ts",
  "lib/log.ts",
  "lib/http.ts",
  "docs/context-pack/TASK_TEMPLATE.md"
].filter(p => fs.existsSync(p));

function read(p){ return fs.readFileSync(path.resolve(p), "utf8"); }
const filesBlob = CANDIDATE_FILES.map(p => `=== FILE: ${p} ===\n${read(p)}\n=== END FILE ===`).join("\n\n");

const taskArg = process.argv.slice(2).join(" ").trim();
let taskFromStdin = "";
if (!taskArg && !process.stdin.isTTY) taskFromStdin = fs.readFileSync(0, "utf8");
const TASK = taskArg || taskFromStdin || "TASK: Beschrijf de taak a.u.b.";

const SYSTEM = [
  "Je bent een strikte senior TypeScript/Next.js engineer.",
  "Gebruik App Router Route Handlers.",
  "Respecteer coding guidelines.",
  "Output ALLEEN volledige files in blokken: === FILE: path === ... === END FILE ==="
].join(" ");

const body = {
  model: "grok-4",
  temperature: 0.2,
  messages: [
    { role: "system", content: SYSTEM },
    { role: "user", content: `PROJECT CONTEXT:\n${filesBlob}` },
    { role: "user", content: TASK }
  ]
};

const r = await fetch("https://api.x.ai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${XAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
if (!r.ok) { console.error(await r.text()); process.exit(1); }

const json = await r.json();
const out = json?.choices?.[0]?.message?.content || "";
fs.mkdirSync("tmp", { recursive: true });
fs.writeFileSync("tmp/grok-output.txt", out, "utf8");
console.log(out);
