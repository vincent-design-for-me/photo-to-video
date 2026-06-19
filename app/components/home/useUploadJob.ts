"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLoginHref } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";
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
  const supabaseRef = useRef(createClient());

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

    const { data: { user } } = await supabaseRef.current.auth.getUser();
    if (!user) {
      setMessage("Sign in to create a video job.");
      router.push(buildLoginHref("/"));
      return;
    }

    setBusy(true);
    setMessage("Creating the job...");

    const fd = new FormData();
    for (const f of files) fd.append("images", f);
    fd.append("aspectRatio", selectedRatio);
    fd.append("styleId", selectedStyle);
    fd.append("resolution", selectedResolution);
    const trimmedEdits = editRequests.map(s => s.trim());
    if (trimmedEdits.some(s => s.length > 0)) fd.append("editRequests", JSON.stringify(trimmedEdits));

    try {
      const createResponse = await fetch("/api/jobs", { method: "POST", body: fd });
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
