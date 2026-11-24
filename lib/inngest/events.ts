import { eventType, staticSchema } from "inngest";

export type JobImagesRequestedData = {
  jobId: string;
  userId?: string;
};

export type JobVideoRequestedData = {
  jobId: string;
  userId?: string;
};

export type JobFrameRegenerateRequestedData = {
  jobId: string;
  frameIndex: number;
  appendText: string;
  userId?: string;
};

export const jobImagesRequested = eventType("job/images.requested", {
  schema: staticSchema<JobImagesRequestedData>(),
});

export const jobVideoRequested = eventType("job/video.requested", {
  schema: staticSchema<JobVideoRequestedData>(),
});

export const jobFrameRegenerateRequested = eventType("job/frame.regenerate.requested", {
  schema: staticSchema<JobFrameRegenerateRequestedData>(),
});
