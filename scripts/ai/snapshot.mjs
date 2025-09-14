import fs from "node:fs";
import path from "node:path";

const listPath = process.argv[2] || "docs/context-pack/CONTEXT_FILES.sample.json";
if (!fs.existsSync(listPath)) {
  console.error(`Context list not found: ${listPath}`);
  process.exit(1);
}
const files = JSON.parse(fs.readFileSync(listPath, "utf8"));
const exists = (p) => fs.existsSync(p);

function read(p) {
  return fs.readFileSync(path.resolve(p), "utf8");
}

const out = files
  .filter(exists)
  .map(p => `=== FILE: ${p} ===\n${read(p)}\n=== END FILE ===`)
  .join("\n\n");

console.log(out || "/* no files found */");
