import { NextResponse } from "next/server";
import { getJob } from "../../../../../lib/jobs/store";
import { runWorkflow } from "../../../../../lib/jobs/workflow";

const runningJobs = new Set<string>();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }

  if (!runningJobs.has(id) && job.status !== "complete") {
    runningJobs.add(id);
    runWorkflow(id)
      .catch((error) => console.error(error))
      .finally(() => runningJobs.delete(id));
  }

  return NextResponse.json({ id, status: "running" });
}
