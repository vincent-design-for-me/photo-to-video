import { NextResponse } from "next/server";
import { getJob } from "../../../../../lib/jobs/store";
import { runImagePhase, runVideoPhase } from "../../../../../lib/jobs/workflow";

const runningJobs = new Set<string>();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }

  if (job.status === "complete") {
    return new NextResponse("Job is already complete", { status: 409 });
  }
  if (job.status === "awaiting_review") {
    return new NextResponse("Job is awaiting review — use POST /approve to proceed to video", { status: 409 });
  }

  if (!runningJobs.has(id)) {
    runningJobs.add(id);

    // If image phase is already done (frames exist) but video phase failed, resume from video
    const framesComplete = job.generatedFrames && job.generatedFrames.length === job.sourceImages.length;
    const phase = framesComplete ? runVideoPhase : runImagePhase;

    phase(id)
      .catch((error) => console.error(error))
      .finally(() => runningJobs.delete(id));
  }

  return NextResponse.json({ id, status: "running" });
}
