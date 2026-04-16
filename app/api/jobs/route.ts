import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildJobAsset, createJob, ensureJobDirs } from "../../../lib/jobs/store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("images").filter((value): value is File => value instanceof File);
  const styleId = stringValue(formData.get("styleId"));

  if (files.length === 0) {
    return new NextResponse("Upload at least one image", { status: 400 });
  }

  if (files.length > 6) {
    return new NextResponse("Upload a maximum of 6 images", { status: 400 });
  }

  const jobId = randomUUID();
  const rootDir = await ensureJobDirs(jobId);
  const sourceDir = path.join(rootDir, "source");
  await mkdir(sourceDir, { recursive: true });

  const assets = [];
  for (const [index, file] of files.entries()) {
    const extension = extensionFor(file.name, file.type);
    const safeName = `source-${index + 1}${extension}`;
    const outputPath = path.join(sourceDir, safeName);
    await writeFile(outputPath, Buffer.from(await file.arrayBuffer()));
    assets.push(await buildJobAsset(outputPath, file.name || safeName, file.type || "image/jpeg"));
  }

  const job = await createJob(assets, jobId, styleId);
  return NextResponse.json({ id: job.id, status: job.status });
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extensionFor(name: string, type: string): string {
  const fromName = path.extname(name);
  if (fromName) return fromName.toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}
