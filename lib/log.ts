type Fields = Record<string, unknown>;

function base(level: "info" | "warn" | "error", msg: string, fields?: Fields) {
const line = { level, msg, ...fields, t: new Date().toISOString() };
// eslint-disable-next-line no-console
(level === "error" ? console.error : level === "warn" ? console.warn : console.log)(
JSON.stringify(line)
);
}

export const log = {
info: (m: string, f?: Fields) => base("info", m, f),
warn: (m: string, f?: Fields) => base("warn", m, f),
error: (m: string, f?: Fields) => base("error", m, f)
};