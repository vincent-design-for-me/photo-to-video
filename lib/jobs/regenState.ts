// Shared in-memory state for in-flight frame regenerations.
// Keyed as "${jobId}:${frameIndex}".
export const regeneratingFrames = new Set<string>();
