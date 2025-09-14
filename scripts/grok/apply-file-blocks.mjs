import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2] || "tmp/grok-output.txt";
if (!fs.existsSync(SRC)) { console.error(`Not found: ${SRC}`); process.exit(1); }

const text = fs.readFileSync(SRC, "utf8");
const regex = /=== FILE:\s*(.+?)\s*===\n([\s\S]*?)\n=== END FILE ===/g;

let m, count = 0;
while ((m = regex.exec(text)) !== null) {
  const rel = m[1].trim();
  const content = m[2];
  const abs = path.resolve(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log(`Wrote ${rel}`);
  count++;
}
if (!count) { console.error("No FILE blocks found."); process.exit(2); }
