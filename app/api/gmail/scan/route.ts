export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobQueue";

// Start de scan: geeft direct 202 + jobId terug en draait async verder
export async function POST() {
const jobId = createJob(async (update) => {
// TODO: vervang door échte Gmail-logic. Dit is een demo-progress.
for (let i = 1; i <= 10; i++) {
await new Promise((r) => setTimeout(r, 300));
update(i * 10);
}
// Demo-resultaat
return {
companies: [],
scannedThreads: 123,
note: "Demo-resultaat. Vervang door echte Gmail-scan.",
};
});

return NextResponse.json({ jobId }, { status: 202 });
}