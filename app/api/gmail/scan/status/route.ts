export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getJob, publicJob } from "@/lib/jobQueue";

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const jobId = searchParams.get("jobId");

if (!jobId) {
return NextResponse.json(
{ error: "Missing jobId" },
{ status: 400 }
);
}

const job = getJob(jobId);
if (!job) {
return NextResponse.json({ error: "Job not found" }, { status: 404 });
}

return NextResponse.json(publicJob(job), { status: 200 });
}