import { after, NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { runVideoPhase } from "../../../../../lib/jobs/workflow";
import { regeneratingFrames } from "../../../../../lib/jobs/regenState";

const runningJobs = new Set<string>();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) {
    return result.response;
  }
  const { job } = result;
  if (job.status !== "awaiting_review") {
    return new NextResponse("Job is not in review state", { status: 409 });
  }

  const anyRunning = job.steps.some((s) => s.kind === "image" && s.status === "running");
  if (anyRunning) {
    return new NextResponse("Some frames are still regenerating — wait for them to finish", { status: 409 });
  }

  const anyPending = [...regeneratingFrames].some((k) => k.startsWith(`${id}:`));
  if (anyPending) {
    return new NextResponse("Some frames are still regenerating", { status: 409 });
  }

  if (!runningJobs.has(id)) {
    runningJobs.add(id);
    after(async () => {
      try {
        await runVideoPhase(id);
      } catch (error) {
        console.error(error);
      } finally {
        runningJobs.delete(id);
      }
    });
  }

  return NextResponse.json({ id, status: "running" }, { status: 202 });
}
