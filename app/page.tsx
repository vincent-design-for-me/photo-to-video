"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_INTERIOR_STYLE_ID, INTERIOR_STYLE_PROMPTS } from "../lib/prompts/interiorStyles";

const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "1:1",  label: "1:1" },
  { value: "3:4",  label: "3:4" },
];

const RESOLUTION_OPTIONS = [
  { value: "720p",  label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "4k",    label: "4K" },
];

const STYLE_OPTIONS = INTERIOR_STYLE_PROMPTS.map(s => ({ value: s.id, label: s.name }));

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function detectAspectRatio(width: number, height: number): string {
  if (width > height) return "16:9";
  if (height > width) return "3:4";
  return "1:1";
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

function ControlRow({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  hint?: string | null;
}) {
  const name = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="control-row">
      <span className="control-label">
        {label}
        {hint && <span className="detected-hint">{hint}</span>}
      </span>
      <div className="pill-group">
        {options.map(opt => (
          <label className="pill-option" key={opt.value}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [detectedRatio, setDetectedRatio] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState("3:4");
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_INTERIOR_STYLE_ID);
  const [selectedResolution, setSelectedResolution] = useState("1080p");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const uploadRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const particlesEl = document.getElementById("mouse-particles");
    let lastParticle = 0;

    function spawnParticle(x: number, y: number) {
      if (!particlesEl) return;
      const p = document.createElement("div");
      p.className = "mouse-particle";
      const size = Math.random() * 20 + 8;
      const dx = (Math.random() - 0.5) * 140;
      const dy = Math.random() * 90 + 40;
      p.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;--dx:${dx}px;--dy:${dy}px`;
      particlesEl.appendChild(p);
      setTimeout(() => p.remove(), 2800);
    }

    function onMouseMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastParticle > 12) {
        spawnParticle(e.clientX, e.clientY);
        spawnParticle(e.clientX, e.clientY);
        lastParticle = now;
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  function acceptFiles(incoming: File[]) {
    const valid = incoming.filter(f => ACCEPTED_TYPES.has(f.type));
    if (valid.length === 0) return;
    const space = 6 - files.length;
    if (space <= 0) return;
    const toAdd = valid.slice(0, space);
    const newUrls = toAdd.map(f => URL.createObjectURL(f));
    const nextFiles = [...files, ...toAdd];
    setFiles(nextFiles);
    setPreviewUrls([...previewUrls, ...newUrls]);
    readImageDimensions(nextFiles[0]).then(({ width, height }) => {
      const ratio = detectAspectRatio(width, height);
      setDetectedRatio(ratio);
      setSelectedRatio(ratio);
    }).catch(() => {});
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles(files.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
  }

  function onBrowseClick() {
    fileInputRef.current?.click();
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    acceptFiles(Array.from(e.dataTransfer.files));
  }

  function scrollToUpload() {
    uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setMessage("Creating the job...");

    const fd = new FormData();
    for (const f of files) fd.append("images", f);
    fd.append("aspectRatio", selectedRatio);
    fd.append("styleId", selectedStyle);
    fd.append("resolution", selectedResolution);

    try {
      const createResponse = await fetch("/api/jobs", { method: "POST", body: fd });
      if (!createResponse.ok) throw new Error(await createResponse.text());
      const job = (await createResponse.json()) as { id: string };
      setMessage("Starting Nano Banana and Kling workflow...");
      await fetch(`/api/jobs/${job.id}/run`, { method: "POST" });
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create job");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <video
        className="bg-video"
        src="/bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div className="bg-video-overlay" aria-hidden="true" />
      <div id="mouse-particles" aria-hidden="true" />

      <header className="site-header">
        <a className="logo" href="/">Photo → Video</a>
        <nav className="nav-pill" aria-label="Site navigation">
          <a href="/" aria-current="page">Home</a>
          <a href="#cases">Cases</a>
        </nav>
        <button type="button" className="cta-dark" onClick={scrollToUpload}>
          Create Now →
        </button>
      </header>

      <main className="hero-main">
        <section className="hero">
          <span className="badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="7" width="18" height="14" rx="2.5" />
              <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
              <polygon points="10.5,12 10.5,17 15.5,14.5" fill="currentColor" stroke="none" />
            </svg>
            Your AI Video Starts Here
          </span>
          <h1>
            <span className="hero-soft">Create Videos Instantly</span>
            <br />
            <span className="hero-soft">with a </span><strong>Single Upload</strong>
          </h1>
          <p className="hero-lede">
            Upload room photos. Our AI restyles, animates, and assembles a polished vertical
            video — perfect for listings, short‑form ads, and portfolio pieces.
          </p>
        </section>

        <section
          id="upload"
          ref={uploadRef as React.RefObject<HTMLElement>}
          className="upload-card"
        >
          <div className="upload-head">
            <h2>Upload Room Photos</h2>
            <span className="fineprint">Up to X images</span>
          </div>
          <div
            className={`dropzone${isDragging ? " is-dragging" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {files.length === 0 ? (
              <div className="empty-state">
                <svg className="cloud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
                <h3>Choose files or drag &amp; drop them here</h3>
                <p className="formats">JPEG, PNG, WebP · up to X photos</p>
                <button type="button" className="browse-btn" onClick={onBrowseClick}>
                  Browse Files
                </button>
              </div>
            ) : (
              <div className="thumb-strip-wrap">
                <div className="thumb-strip">
                  {files.map((f, i) => (
                    <div key={i} className="thumb">
                      <img src={previewUrls[i]} alt={f.name} />
                      <button
                        type="button"
                        className="thumb-remove"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {files.length < 6 && (
                    <button
                      type="button"
                      className="thumb-add"
                      onClick={onBrowseClick}
                      aria-label="Add more photos"
                    >
                      +
                    </button>
                  )}
                </div>
                <p className="fineprint" style={{ marginTop: "12px", textAlign: "center" }}>
                  {files.length} of 6 photos · drag more here or click +
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileInputChange}
            />
          </div>
        </section>

        <div className={`controls-reveal${files.length > 0 ? " visible" : ""}`}>
        <form className="controls" onSubmit={submit}>
          <ControlRow
            label="Aspect Ratio"
            options={ASPECT_RATIO_OPTIONS}
            value={selectedRatio}
            onChange={setSelectedRatio}
            hint={detectedRatio ? "· detected from your photo" : null}
          />
          <ControlRow
            label="Interior Style"
            options={STYLE_OPTIONS}
            value={selectedStyle}
            onChange={setSelectedStyle}
          />
          <ControlRow
            label="Resolution"
            options={RESOLUTION_OPTIONS}
            value={selectedResolution}
            onChange={setSelectedResolution}
          />
          <div className="cta-row">
            <button
              className="primary"
              type="submit"
              disabled={busy || files.length === 0}
            >
              {busy ? "Creating…" : "Generate Video →"}
            </button>
            {message && <span className="status">{message}</span>}
          </div>
        </form>
        </div>
      </main>
    </div>
  );
}
