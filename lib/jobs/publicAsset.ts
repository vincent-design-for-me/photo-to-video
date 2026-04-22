import path from "node:path";

type JobAssetLike = {
  path: string;
};

export function getStorageObjectKeyForWorkflowFile(jobId: string, filePath: string): string | undefined {
  if (!filePath) {
    return undefined;
  }

  if (filePath.startsWith(`${jobId}/`)) {
    return filePath;
  }

  const filename = path.basename(filePath);
  if (!filename) {
    return undefined;
  }

  const parent = path.basename(path.dirname(filePath));
  if (parent === "source" || parent === "generated" || parent === "clips") {
    return `${jobId}/${parent}/${filename}`;
  }

  if (filename === "final.mp4") {
    return `${jobId}/${filename}`;
  }

  return undefined;
}

export function getStorageObjectKeyForPublicAsset(
  filename: string,
  sourceImages: JobAssetLike[],
  generatedFrames: string[]
): string | undefined {
  const allKeys = [...sourceImages.map((image) => image.path), ...generatedFrames];
  return allKeys.find((key) => path.basename(key) === filename);
}
