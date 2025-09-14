type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
id: string;
status: JobStatus;
progress: number; // 0..100
result?: unknown;
error?: string;
startedAt: number;
updatedAt: number;
}

// Persistente module-scope store (ook bij hot-reload)
const g = globalThis as any;
const store: Map<string, Job> = g.JOB_STORE ?? new Map();
if (!g.JOB_STORE) g.JOB_STORE = store;

function now() {
return Date.now();
}

export function createJob(
runner: (update: (p: number) => void) => Promise<unknown>
): string {
const id =
(globalThis.crypto && "randomUUID" in globalThis.crypto
? crypto.randomUUID()
: Math.random().toString(36).slice(2)) as string;

const job: Job = {
id,
status: "queued",
progress: 0,
startedAt: now(),
updatedAt: now(),
};
store.set(id, job);

(async () => {
job.status = "running";
try {
const result = await runner((p) => {
job.progress = Math.max(0, Math.min(100, Math.round(p)));
job.updatedAt = now();
});
job.result = result;
job.status = "succeeded";
} catch (e: any) {
job.error = e?.message ?? "Unknown error";
job.status = "failed";
} finally {
job.progress = job.status === "succeeded" ? 100 : job.progress;
job.updatedAt = now();
store.set(id, job);
}
})();

return id;
}

export function getJob(id: string) {
return store.get(id) || null;
}

export function publicJob(job: Job) {
return {
id: job.id,
status: job.status,
progress: job.progress,
result: job.result,
error: job.error,
};
}