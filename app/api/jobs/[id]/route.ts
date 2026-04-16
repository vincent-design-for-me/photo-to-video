import { NextResponse } from "next/server";
import { getJob } from "../../../../lib/jobs/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }
  return NextResponse.json(sanitizeJob(job));
}

function sanitizeJob<T extends { rootDir?: string }>(job: T): T {
  return { ...job, rootDir: undefined };
}
