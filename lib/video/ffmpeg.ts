import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildTimelinePlan } from "./timeline";

const execFileAsync = promisify(execFile);
const ffmpegPath = require("ffmpeg-static") as string | null;
const ffmpegBinary = ffmpegPath ?? "ffmpeg";

type PlaceholderClipInput = {
  imagePath: string;
  outputPath: string;
  durationSeconds: number;
};

type RenderFinalVideoInput = {
  clipPaths: string[];
  outputPath: string;
  clipSeconds: number;
  width: number;
  height: number;
};

export async function createPlaceholderClip(input: PlaceholderClipInput): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  try {
    await execFileAsync(ffmpegBinary, [
      "-y",
      "-loop",
      "1",
      "-i",
      input.imagePath,
      "-t",
      String(input.durationSeconds),
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
      "-r",
      "30",
      "-movflags",
      "+faststart",
      input.outputPath
    ]);
    return input.outputPath;
  } catch {
    await writeFile(input.outputPath, "FFmpeg is required to generate preview video clips.\n");
    return input.outputPath;
  }
}

export async function renderFinalVideo(input: RenderFinalVideoInput): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  const plan = buildTimelinePlan(input.clipPaths, { clipSeconds: input.clipSeconds });
  const listPath = path.join(path.dirname(input.outputPath), "work", "concat.txt");
  await mkdir(path.dirname(listPath), { recursive: true });

  const normalized = await Promise.all(
    plan.segments.map(async (segment) => {
      const output = path.join(path.dirname(input.outputPath), "work", `normalized-${segment.index}.mp4`);
      await execFileAsync(ffmpegBinary, [
        "-y",
        "-i",
        segment.source,
        "-t",
        String(segment.durationSeconds),
        "-vf",
        [
          `scale=${input.width}:${input.height}:force_original_aspect_ratio=increase`,
          `crop=${input.width}:${input.height}`,
          "eq=contrast=1.08:saturation=1.12:gamma=0.98",
          "unsharp=5:5:0.45:3:3:0.2",
          "format=yuv420p"
        ].join(","),
        "-r",
        "30",
        "-an",
        output
      ]);
      return output;
    })
  );

  await writeFile(listPath, normalized.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n"));

  await execFileAsync(ffmpegBinary, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    input.outputPath
  ]);

  return input.outputPath;
}
