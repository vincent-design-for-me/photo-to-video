"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { buildLoginHref } from "@/lib/auth/paths";
import {
  ACCEPTED_TYPES,
  DEFAULT_INTERIOR_STYLE_ID,
  detectAspectRatio,
  readImageDimensions,
} from "./uploadConfig";

/**
 * Owns the upload experience: selected files & previews, generation controls,
 * the lightbox, and the job-creation submit flow. Keeps all of this stateful
 * logic out of the page component so the UI pieces stay declarative.
 */
export function useUploadJob() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [detectedRatio, setDetectedRatio] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState("3:4");
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_INTERIOR_STYLE_ID);
  const [selectedResolution, setSelectedResolution] = useState("1080p");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [editRequests, setEditRequests] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox keyboard nav + scroll lock
  useEffect(() => {
    if (lightboxIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowRight") setLightboxIndex(i => (i === null ? null : Math.min(i + 1, previewUrls.length - 1)));
      else if (e.key === "ArrowLeft")  setLightboxIndex(i => (i === null ? null : Math.max(i - 1, 0)));
    }
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [lightboxIndex, previewUrls.length]);

  function acceptFiles(incoming: File[]) {
    const valid = incoming.filter(f => ACCEPTED_TYPES.has(f.type));
    if (valid.length === 0) return;
    const newUrls = valid.map(f => URL.createObjectURL(f));
    const nextFiles = [...files, ...valid];
    setFiles(nextFiles);
    setPreviewUrls([...previewUrls, ...newUrls]);
    setEditRequests([...editRequests, ...valid.map(() => "")]);
    readImageDimensions(nextFiles[0]).then(({ width, height }) => {
      const ratio = detectAspectRatio(width, height);
      setDetectedRatio(ratio);
      setSelectedRatio(ratio);
    }).catch(() => {});
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previewUrls[index]);
    const nextLength = files.length - 1;
    setFiles(files.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
    setEditRequests(editRequests.filter((_, i) => i !== index));
    if (lightboxIndex !== null) {
      if (nextLength === 0) setLightboxIndex(null);
      else if (index === lightboxIndex) setLightboxIndex(Math.min(lightboxIndex, nextLength - 1));
      else if (index < lightboxIndex) setLightboxIndex(lightboxIndex - 1);
    }
  }

  function clearFiles() {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviewUrls([]);
    setEditRequests([]);
    setLightboxIndex(null);
    setDetectedRatio(null);
  }

  function updateEditRequest(index: number, value: string) {
    const next = [...editRequests];
    next[index] = value;
    setEditRequests(next);
  }

  function onBrowseClick() { fileInputRef.current?.click(); }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); acceptFiles(Array.from(e.dataTransfer.files)); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) return;

    const sessionRes = await authClient.getSession();
    if (!sessionRes.data?.user) {
      setMessage("Sign in to create a video job.");
      router.push(buildLoginHref("/"));
      return;
    }

    setBusy(true);
    setMessage("Preparing upload...");

    const trimmedEdits = editRequests.map(s => s.trim());
    const hasEdits = trimmedEdits.some(s => s.length > 0);

    try {
      let createResponse: Response;

      // Prefer direct-to-Cloudflare-R2 upload via presigned PUT URLs to bypass
      // Vercel's 4.5 MB Serverless Function request body limit.
      const prepResponse = await fetch("/api/jobs/upload-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map((f) => ({
            name: f.name,
            type: f.type || "image/jpeg",
            size: f.size,
          })),
        }),
      });

      if (prepResponse.status === 401 || prepResponse.status === 403) {
        setMessage("Your session expired. Please sign in again.");
        setBusy(false);
        router.push(buildLoginHref("/"));
        return;
      }

      if (prepResponse.ok) {
        const prepared = (await prepResponse.json()) as {
          jobId: string;
          uploads: Array<{
            index: number;
            key: string;
            path: string;
            signedUrl: string;
            name: string;
            type: string;
            size: number;
          }>;
        };

        setMessage(`Uploading ${files.length} photo${files.length > 1 ? "s" : ""}...`);
        const concurrency = 3;
        let cursor = 0;
        const uploadWorker = async () => {
          while (true) {
            const idx = cursor;
            cursor += 1;
            if (idx >= prepared.uploads.length) return;
            const target = prepared.uploads[idx];
            const file = files[target.index];
            const putRes = await fetch(target.signedUrl, {
              method: "PUT",
              headers: {
                "Content-Type": target.type || file.type || "image/jpeg",
              },
              body: file,
            });
            if (!putRes.ok) {
              throw new Error(`Upload failed for ${file.name} (${putRes.status})`);
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(concurrency, prepared.uploads.length) }, uploadWorker)
        );

        setMessage("Creating the job...");
        createResponse = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: prepared.jobId,
            files: prepared.uploads.map((u) => ({
              key: u.key,
              name: u.name,
              type: u.type,
              size: u.size,
            })),
            aspectRatio: selectedRatio,
            styleId: selectedStyle,
            resolution: selectedResolution,
            ...(hasEdits ? { editRequests: trimmedEdits } : {}),
          }),
        });
      } else if (prepResponse.status === 501) {
        // Fallback for non-Supabase local dev mode.
        setMessage("Creating the job...");
        const fd = new FormData();
        for (const f of files) fd.append("images", f);
        fd.append("aspectRatio", selectedRatio);
        fd.append("styleId", selectedStyle);
        fd.append("resolution", selectedResolution);
        if (hasEdits) fd.append("editRequests", JSON.stringify(trimmedEdits));
        createResponse = await fetch("/api/jobs", { method: "POST", body: fd });
      } else {
        throw new Error(await prepResponse.text());
      }

      if (createResponse.status === 401 || createResponse.status === 403) {
        setMessage("Your session expired. Please sign in again.");
        setBusy(false);
        router.push(buildLoginHref("/"));
        return;
      }
      if (!createResponse.ok) throw new Error(await createResponse.text());
      const job = (await createResponse.json()) as { id: string };
      setMessage("Starting Nano Banana and Kling workflow...");
      const runResponse = await fetch(`/api/jobs/${job.id}/run`, { method: "POST" });
      if (!runResponse.ok) {
        const runError = await runResponse.text();
        router.push(`/jobs/${job.id}?runError=${encodeURIComponent(runError)}`);
        return;
      }
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create job");
      setBusy(false);
    }
  }

  return {
    // state
    message, busy, detectedRatio, selectedRatio, selectedStyle, selectedResolution,
    files, previewUrls, editRequests, isDragging, lightboxIndex,
    // setters & handlers
    setSelectedRatio, setSelectedStyle, setSelectedResolution, setLightboxIndex,
    fileInputRef, acceptFiles, removeFile, clearFiles, updateEditRequest,
    onBrowseClick, onFileInputChange, onDragOver, onDragLeave, onDrop, submit,
  };
}

export type UploadJob = ReturnType<typeof useUploadJob>;
