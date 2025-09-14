"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status =
| { status: "idle" }
| { status: "starting" }
| { status: "running"; jobId: string; progress: number }
| { status: "succeeded"; jobId: string; result: unknown }
| { status: "failed"; jobId: string; error: string };

export default function ScanGmailClient() {
const [state, setState] = useState<Status>({ status: "idle" });
const timer = useRef<ReturnType<typeof setInterval> | null>(null);

const poll = useCallback(async (jobId: string) => {
try {
const url = "/api/gmail/scan/status?jobId=" + encodeURIComponent(jobId);
const r = await fetch(url);
if (!r.ok) throw new Error("Status HTTP " + r.status);
const s = await r.json();
if (s.status === "succeeded") {
setState({ status: "succeeded", jobId, result: s.result });
if (timer.current) clearInterval(timer.current);
} else if (s.status === "failed") {
setState({ status: "failed", jobId, error: s.error || "Unknown error" });
if (timer.current) clearInterval(timer.current);
} else {
setState({ status: "running", jobId, progress: s.progress ?? 0 });
}
} catch (e: any) {
setState({ status: "failed", jobId, error: e?.message ?? "Network error" });
if (timer.current) clearInterval(timer.current);
}
}, []);

const start = useCallback(async () => {
if (timer.current) clearInterval(timer.current);
setState({ status: "starting" });
try {
const r = await fetch("/api/gmail/scan", { method: "POST" });
if (!r.ok) throw new Error("Start HTTP " + r.status);
const data = (await r.json()) as { jobId: string };
const jobId = data.jobId;
setState({ status: "running", jobId, progress: 0 });
timer.current = setInterval(() => poll(jobId), 800);
poll(jobId);
} catch (e: any) {
setState({
status: "failed",
jobId: "unknown",
error: e?.message ?? "Start failed",
});
}
}, [poll]);

useEffect(() => {
return () => {
if (timer.current) clearInterval(timer.current);
};
}, []);

return (
<div className="space-y-3">
<button
type="button"
onClick={start}
disabled={state.status === "starting" || state.status === "running"}
className="rounded-md bg-green-600 px-4 py-2 text-white disabled:opacity-50"
>
{state.status === "starting" || state.status === "running"
? "Scanning..."
: "Scan Gmail"}
</button>
{state.status === "running" && (
    <div className="text-sm text-gray-700">Progress: {state.progress}%</div>
  )}
  {state.status === "succeeded" && (
    <pre className="text-xs bg-gray-100 p-2 rounded">
      {JSON.stringify(state.result, null, 2)}
    </pre>
  )}
  {state.status === "failed" && (
    <div className="text-sm text-red-600">Scan failed: {state.error}</div>
  )}
</div>
);
}