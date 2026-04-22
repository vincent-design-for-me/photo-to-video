import { after, NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { runImagePhase, runVideoPhase } from "../../../../../lib/jobs/workflow";

const runningJobs = new Set<string>();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) {
    return result.response;
  }
  const { job } = result;

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

    after(async () => {
      try {
        await phase(id);
      } catch (error) {
        console.error(error);
      } finally {
        runningJobs.delete(id);
      }
    });
  }

  return NextResponse.json({ id, status: "running" });
}
