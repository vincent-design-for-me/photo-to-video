import { NextResponse } from "next/server";
import { createClient as createServerClient } from "../supabase/server";
import { isSupabaseMode } from "../supabase";
import { getJob } from "./store";
import type { VideoJob } from "./types";

type OwnedJobResult =
  | { job: VideoJob; userId?: string; response?: undefined }
  | { job?: undefined; userId?: undefined; response: NextResponse };

export async function requireAuthenticatedUserId(): Promise<{
  userId?: string;
  response?: NextResponse;
}> {
  if (!isSupabaseMode()) {
    return {};
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  return { userId: user.id };
}

export async function requireOwnedJob(jobId: string): Promise<OwnedJobResult> {
  const { userId, response } = await requireAuthenticatedUserId();
  if (response) {
    return { response };
  }

  const job = await getJob(jobId);
  if (!job) {
    return { response: new NextResponse("Job not found", { status: 404 }) };
  }

  if (isSupabaseMode() && userId && job.userId !== userId) {
    return { response: new NextResponse("Job not found", { status: 404 }) };
  }

  return { job, userId };
}
