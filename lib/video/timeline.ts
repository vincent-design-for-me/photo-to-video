export type TimelineSegment = {
  source: string;
  index: number;
  startSeconds: number;
  durationSeconds: number;
};

export type TimelineTransition = {
  fromIndex: number;
  toIndex: number;
  atSeconds: number;
  durationSeconds: number;
  kind: "fade" | "smoothleft" | "circleopen";
};

export type TimelinePlan = {
  segments: TimelineSegment[];
  transitions: TimelineTransition[];
  totalDurationSeconds: number;
};

const TRANSITIONS: TimelineTransition["kind"][] = ["fade", "smoothleft", "circleopen"];

export function buildTimelinePlan(
  clipSources: string[],
  options: { clipSeconds?: number; transitionSeconds?: number; maxClips?: number } = {}
): TimelinePlan {
  const clipSeconds = options.clipSeconds ?? 3;
  const transitionSeconds = options.transitionSeconds ?? 0.45;
  const maxClips = options.maxClips ?? 6;

  if (clipSources.length === 0) {
    throw new Error("At least 1 clip is required");
  }

  if (clipSources.length > maxClips) {
    throw new Error(`A maximum of ${maxClips} clips is supported`);
  }

  const segments = clipSources.map((source, index) => ({
    source,
    index,
    startSeconds: index * clipSeconds,
    durationSeconds: clipSeconds
  }));

  const transitions = segments.slice(0, -1).map((segment, index) => ({
    fromIndex: segment.index,
    toIndex: segment.index + 1,
    atSeconds: segment.startSeconds + clipSeconds - transitionSeconds,
    durationSeconds: transitionSeconds,
    kind: TRANSITIONS[index % TRANSITIONS.length]
  }));

  return {
    segments,
    transitions,
    totalDurationSeconds: clipSources.length * clipSeconds
  };
}
