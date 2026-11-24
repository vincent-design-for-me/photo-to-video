import { after } from "next/server";
import { regenerateFrame, runImagePhase, runVideoPhase } from "../jobs/workflow";
import { inngest, isInngestConfigured } from "./client";
import {
  jobFrameRegenerateRequested,
  jobImagesRequested,
  jobVideoRequested,
} from "./events";

export type DispatchResult =
  | { mode: "inngest"; ids: string[] }
  | { mode: "after" };

export async function dispatchImagePhase(
  jobId: string,
  userId?: string
): Promise<DispatchResult> {
  if (isInngestConfigured()) {
    const res = await inngest.send(jobImagesRequested.create({ jobId, userId }));
    return { mode: "inngest", ids: res.ids };
  }

  after(async () => {
    try {
      await runImagePhase(jobId);
    } catch (error) {
      console.error(`[run] job ${jobId} image phase failed:`, error);
    }
  });
  return { mode: "after" };
}

export async function dispatchVideoPhase(
  jobId: string,
  userId?: string
): Promise<DispatchResult> {
  if (isInngestConfigured()) {
    const res = await inngest.send(jobVideoRequested.create({ jobId, userId }));
    return { mode: "inngest", ids: res.ids };
  }

  after(async () => {
    try {
      await runVideoPhase(jobId);
    } catch (error) {
      console.error(`[approve/run] job ${jobId} video phase failed:`, error);
    }
  });
  return { mode: "after" };
}

export async function dispatchFrameRegeneration(
  jobId: string,
  frameIndex: number,
  appendText: string,
  userId?: string
): Promise<DispatchResult> {
  if (isInngestConfigured()) {
    const res = await inngest.send(
      jobFrameRegenerateRequested.create({ jobId, frameIndex, appendText, userId })
    );
    return { mode: "inngest", ids: res.ids };
  }

  after(async () => {
    try {
      await regenerateFrame(jobId, frameIndex, appendText, { alreadyClaimed: true });
    } catch (error) {
      console.error(`[regenerate] frame ${frameIndex} for job ${jobId} failed:`, error);
    }
  });
  return { mode: "after" };
}
