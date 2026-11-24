import { NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../lib/jobs/ownership";
import { getJudgeLLMConfig } from "../../../../lib/providers/geminiCompat";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) {
    return result.response;
  }
  return NextResponse.json({
    ...sanitizeJob(result.job),
    judgeEnabled: Boolean(getJudgeLLMConfig()),
  });
}

function sanitizeJob<T extends { rootDir?: string }>(job: T): T {
  return { ...job, rootDir: undefined };
}
