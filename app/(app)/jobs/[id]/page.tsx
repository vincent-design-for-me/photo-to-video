import { notFound } from "next/navigation";
import JobClient from "./JobClient";
import { requireOwnedJob } from "@/lib/jobs/ownership";
import { getJudgeLLMConfig } from "@/lib/providers/geminiCompat";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ runError?: string }>;
}) {
  const { id } = await params;
  const { runError } = await searchParams;
  const result = await requireOwnedJob(id);
  if (result.response) {
    if (result.response.status === 404) {
      notFound();
    }
    throw new Error(await result.response.text());
  }

  const initialJob = sanitizeJob(result.job);
  return <JobClient id={id} initialError={runError} initialJob={initialJob} />;
}

function sanitizeJob<T extends { rootDir?: string }>(job: T): T & { judgeEnabled: boolean } {
  return { ...job, rootDir: undefined, judgeEnabled: Boolean(getJudgeLLMConfig()) };
}
