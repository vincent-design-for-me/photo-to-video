"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buildLoginHref } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_INTERIOR_STYLE_ID, INTERIOR_STYLE_PROMPTS } from "../lib/prompts/interiorStyles";

function GallerySlider({ beforeSrc, afterSrc, label }: { beforeSrc: string; afterSrc: string; label: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const move = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => move(ev.clientX);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [move]);

  return (
    <div
      ref={containerRef}
      className="ba-slider gallery-ba-slider"
      onMouseDown={(e) => { onDragStart(e); move(e.clientX); }}
      onTouchStart={(e) => move(e.touches[0].clientX)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      <img className="ba-slider-img" src={afterSrc} alt={`${label} after`} />
      <img className="ba-slider-img" src={beforeSrc} alt={`${label} before`} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="ba-divider" style={{ left: `${pos}%` }} onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}>
        <div className="ba-handle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6l-6 6 6 6" /><path d="M16 6l6 6-6 6" />
          </svg>
        </div>
      </div>
      <span className="ba-chip ba-chip-left">Before</span>
      <span className="ba-chip ba-chip-right">After</span>
    </div>
  );
}

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

const COUNT_WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];

function photoCountLabel(n: number): string {
  const word = n <= 20 ? COUNT_WORDS[n] : String(n);
  return `${word} ${n === 1 ? "photo" : "photos"}`;
}

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
  const supabaseRef = useRef(createClient());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [detectedRatio, setDetectedRatio] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState("3:4");
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_INTERIOR_STYLE_ID);
  const [selectedResolution, setSelectedResolution] = useState("1080p");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [editRequests, setEditRequests] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pricingAnnual, setPricingAnnual] = useState(false);

  const uploadRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    supabaseRef.current.auth.getUser().then(({ data }) => {
      if (active) setIsAuthenticated(Boolean(data.user));
    });
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const particlesEl = document.getElementById("mouse-particles");
    let lastParticle = 0;
    function spawnParticle(x: number, y: number) {
      if (!particlesEl) return;
      const rect = particlesEl.getBoundingClientRect();
      const p = document.createElement("div");
      p.className = "mouse-particle";
      const size = Math.random() * 20 + 8;
      const dx = (Math.random() - 0.5) * 140;
      const dy = Math.random() * 90 + 40;
      p.style.cssText = `width:${size}px;height:${size}px;left:${x - rect.left}px;top:${y - rect.top}px;--dx:${dx}px;--dy:${dy}px`;
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

  // Lightbox keyboard nav
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

  // ── Upload card JSX (shared between modal and any future use) ──────────────
  const uploadCard = (
    <form className="upload-form" onSubmit={submit}>
      <section
        id="upload"
        ref={uploadRef as React.RefObject<HTMLElement>}
        className="upload-card"
      >
        <div className="upload-head">
          <h2>Upload Room Photos</h2>
          <span className="fineprint" />
        </div>
        <div
          className={`dropzone${isDragging ? " is-dragging" : ""}${files.length > 0 ? " has-files" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {files.length === 0 ? (
            <div className="empty-state">
              <button type="button" className="upload-icon-btn" onClick={onBrowseClick} aria-label="Choose files to upload">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15V3" />
                  <path d="M8.5 6.5L12 3l3.5 3.5" />
                  <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
                </svg>
              </button>
              <h3>Drop your photos here</h3>
              <p className="formats">JPEG, PNG, WebP supported</p>
              <button type="button" className="browse-btn" onClick={onBrowseClick}>Browse Files</button>
            </div>
          ) : (
            <div className="thumb-strip-wrap">
              <div className="thumb-strip">
                {files.map((f, i) => (
                  <div key={i} className="thumb">
                    <div className="thumb-image-wrap">
                      <img src={previewUrls[i]} alt={f.name} />
                      <button type="button" className="thumb-remove" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}>×</button>
                      <button type="button" className="thumb-zoom" onClick={() => setLightboxIndex(i)} aria-label={`View ${f.name}`} title="View larger">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-3.5-3.5" />
                          <path d="M11 8v6" />
                          <path d="M8 11h6" />
                        </svg>
                      </button>
                    </div>
                    <textarea
                      className="thumb-edit"
                      placeholder="Optional: changes for this photo…"
                      maxLength={500}
                      value={editRequests[i] ?? ""}
                      onChange={e => { const next = [...editRequests]; next[i] = e.target.value; setEditRequests(next); }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                ))}
                <button type="button" className="thumb-add" onClick={onBrowseClick} aria-label="Add more photos">+</button>
              </div>
              <p className="fineprint" style={{ marginTop: "12px", textAlign: "center" }}>
                {photoCountLabel(files.length)} · drag more here or click +
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

        <div className={`controls-reveal${files.length > 0 ? " visible" : ""}`}>
          <div className="controls">
            <ControlRow label="Aspect Ratio" options={ASPECT_RATIO_OPTIONS} value={selectedRatio} onChange={setSelectedRatio} hint={detectedRatio ? "· detected from your photo" : null} />
            <ControlRow label="Interior Style" options={STYLE_OPTIONS} value={selectedStyle} onChange={setSelectedStyle} />
            <ControlRow label="Resolution" options={RESOLUTION_OPTIONS} value={selectedResolution} onChange={setSelectedResolution} />
          </div>
        </div>

        <div className={`upload-card-footer${files.length > 0 ? " visible" : ""}`}>
          <button type="button" className="upload-cancel-btn" onClick={clearFiles}>
            Cancel
          </button>
          <button className="primary upload-submit-btn" type="submit" disabled={busy || files.length === 0}>
            {busy ? "Creating…" : "Generate Video →"}
          </button>
          {message && <span className="status upload-status">{message}</span>}
        </div>
      </section>
    </form>
  );

  // ── Wait for auth check before rendering anything ─────────────────────────
  if (isAuthenticated === null) return null;

  // ── Unauthenticated landing page ──────────────────────────────────────────
  if (isAuthenticated === false) {
    const pricingPlans = [
      {
        name: "Starter",
        monthlyPrice: "$0",
        annualPrice: "$0",
        videos: "3 videos / month",
        features: ["720p resolution", "3 interior styles", "Standard generation", "Watermarked output"],
        cta: "Get Started Free",
        featured: false,
      },
      {
        name: "Pro",
        monthlyPrice: "$19",
        annualPrice: "$15",
        videos: "30 videos / month",
        features: ["1080p + 4K resolution", "All interior styles", "Priority generation", "No watermark", "Cloud storage", "Cancel anytime"],
        cta: "Start Pro",
        featured: true,
      },
      {
        name: "Business",
        monthlyPrice: "$49",
        annualPrice: "$39",
        videos: "Unlimited videos",
        features: ["All Pro features", "Bulk upload (100+ photos)", "API access", "5 team seats", "Priority support", "Custom branding"],
        cta: "Start Business",
        featured: false,
      },
    ];

    return (
      <div className="landing-page">

        {/* ── Hero ── */}
        <div className="landing-hero">
          <img className="landing-hero-bg" src="/hero-bg.jpg" alt="" aria-hidden="true" />
          <div className="landing-hero-content">
            <h1 className="landing-hero-title">
              Turn Your Photos Into<br />Cinematic Videos
            </h1>
            <p className="landing-hero-subtitle">
              Upload room photos. Our AI restyles, animates, and assembles a polished video — perfect for listings, short-form ads, and portfolio pieces.
            </p>
            <Link href="/signup" className="landing-hero-cta">Get Started Free</Link>
          </div>
        </div>

        {/* ── Sections below hero ── */}
        <div className="lp-sections">

          {/* 1. How It Works */}
          <section className="lp-section" id="how-it-works">
            <div className="lp-container">
              <span className="lp-label">Simple process</span>
              <h2 className="lp-display-lg">Three steps to cinematic</h2>
              <div className="lp-steps-grid">

                {/* Step 1 — Upload */}
                <div className="lp-step-card">
                  <div className="lp-step-mockup">
                    <div className="lp-mock lp-mock--upload">
                      <div className="lp-mock-thumbs">
                        <div className="lp-mock-thumb lp-mock-thumb--peach" />
                        <div className="lp-mock-thumb lp-mock-thumb--sky" />
                        <div className="lp-mock-thumb lp-mock-thumb--lavender" />
                        <div className="lp-mock-thumb lp-mock-thumb--add">+</div>
                      </div>
                      <div className="lp-mock-upload-bar">
                        <span className="lp-mock-cta-pill">Browse Files</span>
                        <span className="lp-mock-format-hint">JPEG &middot; PNG &middot; WebP</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-step-content">
                    <span className="lp-step-num">01</span>
                    <h3 className="lp-step-title">Upload photos</h3>
                    <p className="lp-step-body">Drag and drop your room photos. JPEG, PNG, or WebP accepted — no limit.</p>
                  </div>
                </div>

                {/* Step 2 — AI Generates */}
                <div className="lp-step-card">
                  <div className="lp-step-mockup">
                    <div className="lp-mock lp-mock--generate">
                      <div className="lp-mock-control-row">
                        <span className="lp-mock-ctrl-label">Style</span>
                        <div className="lp-mock-selectors">
                          <span className="lp-mock-sel lp-mock-sel--active">Modern</span>
                          <span className="lp-mock-sel">Luxury</span>
                          <span className="lp-mock-sel">Japandi</span>
                        </div>
                      </div>
                      <div className="lp-mock-control-row">
                        <span className="lp-mock-ctrl-label">Ratio</span>
                        <div className="lp-mock-selectors">
                          <span className="lp-mock-sel">16:9</span>
                          <span className="lp-mock-sel lp-mock-sel--active">3:4</span>
                          <span className="lp-mock-sel">1:1</span>
                        </div>
                      </div>
                      <div className="lp-mock-progress-wrap">
                        <div className="lp-mock-progress-track">
                          <div className="lp-mock-progress-fill" style={{ width: "65%" }} />
                        </div>
                        <span className="lp-mock-progress-label">Generating video&hellip;</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-step-content">
                    <span className="lp-step-num">02</span>
                    <h3 className="lp-step-title">AI generates</h3>
                    <p className="lp-step-body">Our AI restyles each shot and animates them into a polished cinematic sequence.</p>
                  </div>
                </div>

                {/* Step 3 — Download */}
                <div className="lp-step-card">
                  <div className="lp-step-mockup">
                    <div className="lp-mock lp-mock--download">
                      <div className="lp-mock-player">
                        <div className="lp-mock-play-btn">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                            <polygon points="6,4 20,12 6,20" />
                          </svg>
                        </div>
                        <span className="lp-mock-duration">0:47</span>
                      </div>
                      <div className="lp-mock-dl-row">
                        <div className="lp-mock-cta-pill lp-mock-cta-pill--dl">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                            <path d="M12 5v10M7 15l5 5 5-5" /><path d="M5 20h14" />
                          </svg>
                          Download 1080p
                        </div>
                        <span className="lp-mock-format-hint">MP4</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-step-content">
                    <span className="lp-step-num">03</span>
                    <h3 className="lp-step-title">Download &amp; share</h3>
                    <p className="lp-step-body">Export in 720p, 1080p, or 4K — ready for listings, reels, or portfolios.</p>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* 2. Feature Checklist */}
          <section className="lp-section lp-section--soft">
            <div className="lp-container">
              <div className="lp-checklist-grid">
                <div className="lp-checklist-block">
                  <h3 className="lp-checklist-title">Every video includes</h3>
                  <ul className="lp-checklist">
                    {["Cinematic transitions & pans", "AI interior restyling", "Licensed background music", "4K resolution support", "Multiple aspect ratios (16:9, 1:1, 3:4)", "Fast generation — under 2 minutes"].map(f => (
                      <li key={f} className="lp-checklist-item"><span className="lp-check">&#10003;</span>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="lp-checklist-divider" />
                <div className="lp-checklist-block">
                  <h3 className="lp-checklist-title">Every plan includes</h3>
                  <ul className="lp-checklist">
                    {["Unlimited photo uploads per job", "Cloud storage for your videos", "10+ interior styles", "Results in under 12 minutes", "Cancel anytime"].map(f => (
                      <li key={f} className="lp-checklist-item"><span className="lp-check">&#10003;</span>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Stats + Gallery */}
          <section className="lp-section">
            <div className="lp-container">
              <div className="lp-stats-bar">
                <strong className="lp-stat-number">1,240+</strong>&nbsp;videos generated by&nbsp;
                <strong className="lp-stat-number">890+</strong>&nbsp;happy users
                <span className="lp-stars" aria-label="4.9 out of 5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span className="lp-stat-score">4.9 / 5</span>
              </div>
              <div className="lp-gallery-grid">
                {[
                  { label: "Modern Minimalist", img: "/gallery/MODERN MINIMALIST.png",  before: null },
                  { label: "Luxury Modern",     img: "/gallery/Luxury Modern.png",      before: "/gallery/Luxury Modern-Before.png" },
                  { label: "Cozy Scandinavian", img: "/gallery/SCANDINAVIAN.png",       before: null },
                  { label: "Contemporary",      img: "/gallery/Contemporary.png",       before: "/gallery/Contemporary-before.png" },
                  { label: "Wabi-Sabi",         img: "/gallery/wabi-sabi.png",          before: null },
                  { label: "Japandi",           img: "/gallery/Japandi.png",            before: "/gallery/Japandi-before.png" },
                ].map(tile => (
                  <div key={tile.label} className="lp-gallery-tile">
                    {tile.before && tile.img
                      ? <GallerySlider beforeSrc={tile.before} afterSrc={tile.img} label={tile.label} />
                      : tile.img && <img src={tile.img} alt={tile.label} className="lp-gallery-tile-img" />
                    }
                    {!tile.before && <span className="lp-gallery-label">{tile.label}</span>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Testimonials */}
          <section className="lp-section lp-section--soft">
            <div className="lp-container">
              <span className="lp-label">Testimonials</span>
              <h2 className="lp-display-lg">Loved by agents and creators</h2>
              <div className="lp-testimonials-grid">
                {[
                  { quote: "I saved 3 hours per listing. The videos look like a professional videographer shot them.", name: "Sarah M.", role: "Real Estate Agent", init: "S" },
                  { quote: "The interior restyling blew my clients away. They approved listings without visiting in person.", name: "David K.", role: "Interior Designer", init: "D" },
                  { quote: "I use it for every property on my Instagram. The before/after always gets great engagement.", name: "Monica L.", role: "Content Creator", init: "M" },
                ].map(t => (
                  <div key={t.name} className="lp-testimonial-card">
                    <div className="lp-testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                    <p className="lp-testimonial-quote">{t.quote}</p>
                    <div className="lp-testimonial-author">
                      <div className="lp-testimonial-avatar">{t.init}</div>
                      <div>
                        <strong className="lp-testimonial-name">{t.name}</strong>
                        <span className="lp-testimonial-role">{t.role}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5. Features / Controls showcase */}
          <section className="lp-section">
            <div className="lp-container">
              <span className="lp-label">Controls</span>
              <h2 className="lp-display-lg">Every control you need<br />to get it perfect</h2>
              <div className="lp-features-grid">
                {[
                  {
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                      </svg>
                    ),
                    title: "Aspect ratio",
                    body: "Choose 16:9 for listings, 1:1 for social feeds, or 3:4 for vertical reels.",
                  },
                  {
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 3a9 9 0 0 1 6.36 15.36" />
                        <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
                      </svg>
                    ),
                    title: "Interior style",
                    body: "Modern, Scandinavian, Industrial, Luxury — 10+ styles to match any property.",
                  },
                  {
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                    ),
                    title: "Resolution",
                    body: "Export in 720p for quick previews or 4K for premium listing presentations.",
                  },
                  {
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    ),
                    title: "Background music",
                    body: "AI picks a licensed soundtrack that matches the mood and style of your video.",
                  },
                ].map(f => (
                  <div key={f.title} className="lp-feature-card">
                    <span className="lp-feature-icon">{f.icon}</span>
                    <h3 className="lp-feature-title">{f.title}</h3>
                    <p className="lp-feature-body">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Why Our AI / Comparison */}
          <section className="lp-section lp-section--soft">
            <div className="lp-container">
              <span className="lp-label">Why Photo-to-Video AI?</span>
              <h2 className="lp-display-lg">A faster way to beautiful video</h2>
              <div className="lp-comparison-grid">
                <div className="lp-comparison-col lp-comparison-col--ours">
                  <h3 className="lp-comparison-head">With our AI</h3>
                  {["Ready in under 2 minutes", "No video editing skills needed", "Consistent, cinematic quality every time", "Multiple style decisions at once", "10+ interior styles on demand"].map(item => (
                    <div key={item} className="lp-comparison-row lp-comparison-row--pro">
                      <span className="lp-comparison-icon">&#10003;</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="lp-comparison-col lp-comparison-col--theirs">
                  <h3 className="lp-comparison-head">Traditional approach</h3>
                  {["Hours of editing in Premiere or DaVinci", "Requires professional skills or a hire", "Results vary with every editor", "One video revision at a time", "Costly reshoots for different styles"].map(item => (
                    <div key={item} className="lp-comparison-row lp-comparison-row--con">
                      <span className="lp-comparison-icon">&#10007;</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 7. Mid-page CTA band */}
          <section className="lp-cta-band">
            <div className="lp-container lp-cta-band-inner">
              <h2 className="lp-display-lg lp-cta-band-title">Ready to transform your photos?</h2>
              <p className="lp-cta-sub">No credit card required. Cancel anytime.</p>
              <Link href="/signup" className="lp-btn-ink">Generate Your First Video Free &rarr;</Link>
            </div>
          </section>

          {/* 8. Pricing */}
          <section className="lp-section" id="pricing">
            <div className="lp-container">
              <span className="lp-label">Pricing</span>
              <h2 className="lp-display-lg">Plans for everyone</h2>
              <p className="lp-section-sub">Start free. Upgrade as you grow.</p>
              <div className="lp-pricing-toggle">
                <button
                  className={`lp-toggle-btn${!pricingAnnual ? " lp-toggle-btn--active" : ""}`}
                  onClick={() => setPricingAnnual(false)}
                >Monthly</button>
                <button
                  className={`lp-toggle-btn${pricingAnnual ? " lp-toggle-btn--active" : ""}`}
                  onClick={() => setPricingAnnual(true)}
                >Annual <span className="lp-toggle-save">Save 20%</span></button>
              </div>
              <div className="lp-pricing-grid">
                {pricingPlans.map(plan => (
                  <div key={plan.name} className={`lp-pricing-card${plan.featured ? " lp-pricing-card--featured" : ""}`}>
                    {plan.featured && <span className="lp-pricing-badge">Most popular</span>}
                    <h3 className="lp-pricing-name">{plan.name}</h3>
                    <div className="lp-pricing-price">
                      <span className="lp-pricing-amount">{pricingAnnual ? plan.annualPrice : plan.monthlyPrice}</span>
                      <span className="lp-pricing-per">/mo</span>
                    </div>
                    {pricingAnnual && plan.annualPrice !== plan.monthlyPrice && (
                      <p className="lp-pricing-note-annual">billed annually</p>
                    )}
                    <p className="lp-pricing-videos">{plan.videos}</p>
                    <ul className="lp-pricing-features">
                      {plan.features.map(f => (
                        <li key={f} className="lp-pricing-feature">
                          <span className="lp-pricing-check">&#10003;</span>{f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup" className={plan.featured ? "lp-btn-ink lp-btn-block" : "lp-btn-outline lp-btn-block"}>
                      {plan.cta}
                    </Link>
                  </div>
                ))}
              </div>
              <p className="lp-pricing-footer-note">All plans include a 7-day free trial. No credit card required.</p>
            </div>
          </section>

          {/* 9. FAQ */}
          <section className="lp-section lp-section--soft" id="faq">
            <div className="lp-container lp-faq-container">
              <span className="lp-label">FAQ</span>
              <h2 className="lp-display-lg">Frequently asked questions</h2>
              <div className="lp-faq-list">
                {[
                  { q: "What photo formats do you support?", a: "We accept JPEG, PNG, and WebP. Any photo taken on a phone or DSLR will work." },
                  { q: "How long does it take to generate a video?", a: "Most videos are ready in under 2 minutes. 4K resolution or longer sequences may take slightly longer." },
                  { q: "Can I use the videos commercially?", a: "Yes. All videos you create are yours to use commercially — for listings, ads, social media, or client presentations." },
                  { q: "What interior styles are available?", a: "We offer 10+ styles including Modern, Scandinavian, Industrial, Luxury, Bohemian, Coastal, and more. New styles are added regularly." },
                  { q: "What aspect ratios can I export?", a: "16:9 for widescreen presentations, 1:1 for Instagram square, and 3:4 for vertical reels and TikTok." },
                  { q: "Is there a free plan?", a: "Yes — the Starter plan is free forever with 3 videos per month at 720p resolution." },
                  { q: "How do I cancel my subscription?", a: "Cancel anytime from your account settings. No questions asked, no cancellation fees." },
                  { q: "Do I need video editing experience?", a: "Not at all. Just upload your photos, pick a style, and click Generate. We handle the rest." },
                ].map(item => (
                  <details key={item.q} className="lp-faq-item">
                    <summary className="lp-faq-question">{item.q}</summary>
                    <p className="lp-faq-answer">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* 10. Final CTA */}
          <section className="lp-final-cta">
            <div className="lp-orb lp-orb--mint" aria-hidden="true" />
            <div className="lp-orb lp-orb--peach" aria-hidden="true" />
            <div className="lp-container lp-final-cta-inner">
              <h2 className="lp-final-cta-title">Transform your photos<br />into cinematic videos</h2>
              <p className="lp-final-cta-sub">Get started in seconds. No credit card required.</p>
              <Link href="/signup" className="lp-btn-ink lp-btn-ink--lg">Start Free &rarr;</Link>
              <div className="lp-final-stars">
                <span className="lp-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span>Loved by 890+ users</span>
              </div>
            </div>
          </section>

          {/* 11. Footer */}
          <footer className="lp-footer">
            <div className="lp-container">
              <div className="lp-footer-grid">
                <div className="lp-footer-brand">
                  <span className="lp-footer-logo">Photo-to-Video</span>
                  <p className="lp-footer-tagline">Transform room photos into cinematic AI-generated videos in minutes.</p>
                </div>
                <div className="lp-footer-col">
                  <h4 className="lp-footer-col-title">Product</h4>
                  <Link href="/signup" className="lp-footer-link">Get Started</Link>
                  <a href="#pricing" className="lp-footer-link">Pricing</a>
                  <a href="#how-it-works" className="lp-footer-link">How It Works</a>
                  <a href="#faq" className="lp-footer-link">FAQ</a>
                </div>
                <div className="lp-footer-col">
                  <h4 className="lp-footer-col-title">Company</h4>
                  <a href="#" className="lp-footer-link">About</a>
                  <a href="#" className="lp-footer-link">Blog</a>
                </div>
                <div className="lp-footer-col">
                  <h4 className="lp-footer-col-title">Legal</h4>
                  <a href="#" className="lp-footer-link">Privacy Policy</a>
                  <a href="#" className="lp-footer-link">Terms of Service</a>
                </div>
              </div>
            </div>
            <div className="lp-footer-bottom">
              <div className="lp-container">
                <span>&copy; 2026 Photo-to-Video. All rights reserved.</span>
              </div>
            </div>
          </footer>

        </div>{/* .lp-sections */}
      </div>
    );
  }

  // ── Authenticated homepage ─────────────────────────────────────────────────
  return (
    <div className="app-page">
      <img className="landing-hero-bg" src="/auth-app-bg.jpg" alt="" aria-hidden="true" />
      <div id="mouse-particles" aria-hidden="true" />

      <main className="hero-main page-enter">
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

        {uploadCard}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && previewUrls[lightboxIndex] && (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged view of photo ${lightboxIndex + 1}`}
        >
          <button type="button" className="lightbox-close" aria-label="Close enlarged view" onClick={e => { e.stopPropagation(); setLightboxIndex(null); }}>×</button>
          {previewUrls.length > 1 && (
            <button type="button" className="lightbox-nav prev" disabled={lightboxIndex === 0} aria-label="Previous image" onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i === null ? null : Math.max(i - 1, 0))); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <img className="lightbox-img" src={previewUrls[lightboxIndex]} alt={files[lightboxIndex]?.name ?? `Photo ${lightboxIndex + 1}`} onClick={e => e.stopPropagation()} />
          {previewUrls.length > 1 && (
            <button type="button" className="lightbox-nav next" disabled={lightboxIndex === previewUrls.length - 1} aria-label="Next image" onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i === null ? null : Math.min(i + 1, previewUrls.length - 1))); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
          {previewUrls.length > 1 && (
            <div className="lightbox-counter">{lightboxIndex + 1} / {previewUrls.length}</div>
          )}
        </div>
      )}
    </div>
  );
}
