import path from "node:path";
import { renderFinalVideo } from "../lib/video/ffmpeg";

const args = process.argv.slice(2);
const clips: string[] = [];
let width = 1080;
let height = 1920;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--width") { width = Number(args[++i]); }
  else if (args[i] === "--height") { height = Number(args[++i]); }
  else if (args[i] === "--16x9") { width = 1920; height = 1080; }
  else if (args[i] === "--9x16") { width = 1080; height = 1920; }
  else clips.push(args[i]);
}

if (clips.length < 1) {
  console.error("Usage: npx tsx scripts/test-render.ts [--16x9|--9x16] <clip1.mp4> <clip2.mp4> ...");
  process.exit(1);
}

const outputPath = path.join(process.cwd(), "test-output.mp4");
console.log(`Rendering ${clips.length} clip(s) at ${width}x${height} → ${outputPath}`);

renderFinalVideo({ clipPaths: clips, outputPath, clipSeconds: 3, width, height })
  .then(() => console.log("Done:", outputPath))
  .catch((err) => { console.error("Failed:", err); process.exit(1); });
