/**
 * Resume an interrupted job from the point it was cut off.
 * Usage: npx tsx --env-file=.env.local scripts/resume-job.ts <jobId>
 */
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { generateKlingClip } from "../lib/providers/kling";
import { renderFinalVideo } from "../lib/video/ffmpeg";

const JOB_ID = process.argv[2];
if (!JOB_ID) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/resume-job.ts <jobId>");
  process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), ".data", "jobs");
const jobDir = path.join(DATA_DIR, JOB_ID);
const jobFile = path.join(jobDir, "job.json");

async function readJob() {
  return JSON.parse(await readFile(jobFile, "utf8")) as any;
}

async function saveJob(job: any) {
  await writeFile(jobFile, JSON.stringify(job, null, 2));
}

function setStep(job: any, kind: string, index: number, status: string, outputPath?: string) {
  job.steps = job.steps.map((s: any) =>
    s.kind === kind && s.index === index
      ? { ...s, status, outputPath, updatedAt: new Date().toISOString() }
      : s
  );
  job.updatedAt = new Date().toISOString();
}

async function main() {
  const job = await readJob();
  const config = job.config;

  const motionPrompt = `transform from image one to image two with dramatic sound effect when the scene changes with Morph Transition. ${config.motion}`;

  // Collect all generated frames and clips from completed steps
  const generatedFrames: string[] = [];
  const generatedClips: string[] = [];

  for (const img of job.sourceImages) {
    const idx = job.sourceImages.indexOf(img);
    const frameStep = job.steps.find((s: any) => s.kind === "image" && s.index === idx);
    if (frameStep?.outputPath) generatedFrames.push(frameStep.outputPath);
  }

  for (let idx = 0; idx < job.sourceImages.length; idx++) {
    const videoStep = job.steps.find((s: any) => s.kind === "video" && s.index === idx);

    if (videoStep?.status === "complete" && videoStep?.outputPath) {
      generatedClips.push(videoStep.outputPath);
      console.log(`[${idx + 1}/${job.sourceImages.length}] Clip ${idx + 1} already done: ${videoStep.outputPath}`);
      continue;
    }

    // Need to generate this clip
    const image = job.sourceImages[idx];
    const framePath = generatedFrames[idx];
    if (!framePath) {
      throw new Error(`Frame ${idx + 1} not found — cannot generate clip`);
    }

    const outputPath = path.join(jobDir, "clips", `clip-${idx + 1}.mp4`);
    console.log(`[${idx + 1}/${job.sourceImages.length}] Generating Kling clip ${idx + 1}…`);

    setStep(job, "video", idx, "running");
    await saveJob(job);

    const clipPath = await generateKlingClip({
      jobId: JOB_ID,
      firstFramePath: image.path,
      lastFramePath: framePath,
      prompt: motionPrompt,
      aspectRatio: config.aspectRatio,
      clipSeconds: config.clipSeconds,
      outputPath
    });

    generatedClips.push(clipPath);
    setStep(job, "video", idx, "complete", clipPath);
    await saveJob(job);
    console.log(`[${idx + 1}/${job.sourceImages.length}] Clip ${idx + 1} done: ${clipPath}`);
  }

  // FFmpeg final render
  console.log(`\nRunning FFmpeg final render (${generatedClips.length} clips)…`);
  setStep(job, "render", 0, "running");
  await saveJob(job);

  const finalVideoPath = await renderFinalVideo({
    clipPaths: generatedClips,
    outputPath: path.join(jobDir, "final.mp4"),
    clipSeconds: config.clipSeconds,
    width: config.outputWidth,
    height: config.outputHeight
  });

  setStep(job, "render", 0, "complete", finalVideoPath);
  job.generatedFrames = generatedFrames;
  job.generatedClips = generatedClips;
  job.finalVideoPath = finalVideoPath;
  job.status = "complete";
  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  console.log(`\nJob complete! Final video: ${finalVideoPath}`);
}

main().catch((err) => {
  console.error("Resume failed:", err);
  process.exit(1);
});
