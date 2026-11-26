"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AiImageIcon,
  AiMagicIcon,
  AiVideoIcon,
  Alert02Icon,
  ArrowLeftRightIcon,
  ArrowRight02Icon,
  Cancel01Icon,
  CheckmarkBadge02Icon,
  ClapperboardIcon,
  Download04Icon,
  RefreshIcon,
  ZoomInAreaIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon, type IconSvgElement } from "@/app/components/Icon";
import { isJobRunningStale, isTimestampStale } from "@/lib/jobs/stale";
import styles from "./JobClient.module.css";

const STEP_KIND_ICONS: Record<JobStep["kind"], IconSvgElement> = {
  prompt: AiMagicIcon,
  image: AiImageIcon,
  video: AiVideoIcon,
  render: ClapperboardIcon,
};

function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  ratio,
  index,
  className = "",
}: {
  beforeSrc: string;
  afterSrc: string;
  ratio: string;
  index: number;
  className?: string;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const move = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const stopClickAfterDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) return;
    const moved = Math.abs(e.clientX - start.x) > 4 || Math.abs(e.clientY - start.y) > 4;
    if (moved) {
      e.stopPropagation();
    }
  }, []);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      const onMove = (ev: MouseEvent) => move(ev.clientX);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [move]
  );

  return (
    <div
      ref={containerRef}
      className={`ba-slider${className ? ` ${className}` : ""}`}
      style={{ aspectRatio: ratio.replace(":", " / ") }}
      onMouseDown={(e) => { onDragStart(e); move(e.clientX); }}
      onClick={stopClickAfterDrag}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        move(touch.clientX);
      }}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      <img className="ba-slider-img" src={afterSrc} alt={`Generated frame ${index + 1}`} loading="lazy" />
      <img
        className="ba-slider-img"
        src={beforeSrc}
        alt={`Source ${index + 1}`}
        loading="lazy"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div
        className="ba-divider"
        style={{ left: `${pos}%` }}
        onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      >
        <div className="ba-handle">
          <Icon icon={ArrowLeftRightIcon} size={18} strokeWidth={2} />
        </div>
      </div>
      <span className="ba-chip ba-chip-left">Before</span>
      <span className="ba-chip ba-chip-right">After</span>
    </div>
  );
}

type JobStep = {
  id: string;
  kind: "prompt" | "image" | "video" | "render";
  index: number;
  label: string;
  status: "queued" | "running" | "complete" | "failed";
  updatedAt?: string;
};

type FrameJudgement = {
  consistencyScore: number;
  geometryPreserved: number;
  perspectivePreserved: number;
  flaggedIssues: string[];
  rationale: string;
  passed: boolean;
  threshold: number;
  judgedAt: string;
};

type JobPayload = {
  id: string;
  status: "queued" | "running" | "awaiting_review" | "complete" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
  sourceImages: { name: string }[];
  generatedFrames: string[];
  frameJudgements?: (FrameJudgement | null)[];
  framePrompts?: string[];
  generatedClips: string[];
  finalVideoPath?: string;
  config: { aspectRatio: string };
  steps: JobStep[];
  judgeEnabled?: boolean;
};

const JUDGE_PENDING_WINDOW_MS = 120_000;

function cssAspectRatio(ratio: string): string {
  return ratio.replace(":", " / ");
}

export default function JobClient({
  id,
  initialError = "",
  initialJob = null,
}: {
  id: string;
  initialError?: string;
  initialJob?: JobPayload | null;
}) {
  const [job, setJob] = useState<JobPayload | null>(initialJob);
  const [error, setError] = useState(initialError);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lightbox, setLightbox] = useState<{ index: number; kind: "before" | "after" } | null>(null);
  // Tracks indices we submitted regen for locally — gives immediate loading state
  const [localRegen, setLocalRegen] = useState<number[]>([]);
  const pollInFlightRef = useRef(false);

  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);

  const isTerminal = job?.status === "complete" || job?.status === "failed";

  useEffect(() => {
    let active = true;

    async function load() {
      if (pollInFlightRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      pollInFlightRef.current = true;
      try {
        const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as JobPayload;
        if (active) {
          setJob(payload);
          setError("");
          if (payload.status !== "awaiting_review") {
            setApproving(false);
          }
          // Remove from localRegen any index whose step has settled (complete or failed)
          setLocalRegen((prev) =>
            prev.filter((i) => {
              const step = payload.steps.find((s) => s.kind === "image" && s.index === i);
              return step?.status === "running";
            })
          );
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load job");
        }
      } finally {
        pollInFlightRef.current = false;
      }
    }

    load();
    if (isTerminal) {
      return () => {
        active = false;
      };
    }

    const interval = setInterval(load, 2500);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, isTerminal]);

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

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox]);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setJob((prev) => (prev ? { ...prev, status: "running", error: undefined } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume job");
    } finally {
      setRetrying(false);
    }
  }

  async function submitRegen() {
    if (selectedIndex === null || !editText.trim() || submitting) return;
    const targetIndex = selectedIndex;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${id}/frames/${targetIndex}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appendText: editText.trim() })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      // Close panel and immediately show loading on this tile
      setSelectedIndex(null);
      setEditText("");
      setLocalRegen((prev) => prev.includes(targetIndex) ? prev : [...prev, targetIndex]);
    } finally {
      setSubmitting(false);
    }
  }

  async function approveAndGenerate() {
    if (approving) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/jobs/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        setError(await res.text());
        setApproving(false);
      }
    } catch {
      setApproving(false);
    }
  }

  const isReviewMode = job?.status === "awaiting_review";
  const isStaleRunning = job ? isJobRunningStale(job) : false;
  const completedFrameCount = job ? job.generatedFrames.filter(Boolean).length : 0;
  const completedClipCount = job ? job.generatedClips.filter(Boolean).length : 0;
  const anyFrameRunning =
    (job?.steps.some((s) => s.kind === "image" && s.status === "running") ?? false) ||
    localRegen.length > 0;

  const lightboxFrame =
    lightbox !== null && job
      ? {
          index: lightbox.index,
          kind: lightbox.kind,
          step: job.steps.find((s) => s.kind === "image" && s.index === lightbox.index),
        }
      : null;

  return (
    <div className="page">
      {/* The background video and its overlay live in ./layout.tsx so they
          persist across the loading state instead of restarting with the page. */}
      <div id="mouse-particles" aria-hidden="true" />

      <main className="job-main">
        <div className="job-topbar">
          <div>
            <span className="eyebrow">Production job</span>
            <h1>{job ? job.status.replace("_", " ") : "Loading"}</h1>
            <p className="fineprint">Job ID: {id}</p>
          </div>
          <div className="actions">
            {job?.status === "failed" || isStaleRunning ? (
              <button className={`job-action ${styles["icon-inline"]}`} onClick={retry} disabled={retrying}>
                <Icon icon={RefreshIcon} size={15} />
                <span>{retrying ? "Resuming…" : isStaleRunning ? "Resume" : "Retry"}</span>
              </button>
            ) : null}
            {job?.status === "complete" ? (
              <a className={`job-action ${styles["icon-inline"]}`} href={`/api/jobs/${id}/download?download=1`}>
                <Icon icon={Download04Icon} size={15} />
                <span>Download MP4</span>
              </a>
            ) : null}
          </div>
        </div>

        {error ? <p className="error glass-error">{error}</p> : null}
        {job?.error ? <p className="error glass-error">{job.error}</p> : null}

        <section className="glass-panel">
          <h2>Run status</h2>
          <div className="status-grid">
            <div className="status-card">
              <span className="label">Source images</span>
              <span className="value">{job?.sourceImages.length ?? 0}</span>
            </div>
            <div className="status-card">
              <span className="label">Generated frames</span>
              <span className="value">{completedFrameCount}</span>
            </div>
            <div className="status-card">
              <span className="label">Kling clips</span>
              <span className="value">{completedClipCount}</span>
            </div>
            <div className="status-card">
              <span className="label">Final render</span>
              <span className="value">{job?.finalVideoPath ? "Ready" : "Pending"}</span>
            </div>
          </div>
        </section>

        {isReviewMode && job ? (
          <section className="glass-panel">
            <div className="review-header">
              <div>
                <h2>Review Generated Frames</h2>
                <p className="fineprint">Click any image to edit its prompt. Select a tile, describe changes, and hit Regenerate.</p>
              </div>
              <button
                className={`review-approve-btn ${styles["icon-inline"]}`}
                onClick={approveAndGenerate}
                disabled={anyFrameRunning || approving}
              >
                {approving ? (
                  "Starting…"
                ) : anyFrameRunning ? (
                  "Waiting for edits…"
                ) : (
                  <>
                    <Icon icon={AiVideoIcon} size={16} strokeWidth={1.75} />
                    <span>Generate Video</span>
                    <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.75} />
                  </>
                )}
              </button>
            </div>

            <div className="review-grid">
              {job.generatedFrames.map((_, i) => {
                const imageStep = job.steps.find((s) => s.kind === "image" && s.index === i);
                const isServerRunning = imageStep?.status === "running";
                const isRegenerating = isServerRunning || localRegen.includes(i);
                const isFailed = imageStep?.status === "failed" && !isRegenerating;
                const isSelected = selectedIndex === i;
                const judgement = job.frameJudgements?.[i] ?? null;
                const vParam = imageStep?.updatedAt ? `?v=${encodeURIComponent(imageStep.updatedAt)}` : "";

                return (
                  <div
                    key={i}
                    className={`review-tile${isSelected ? " selected" : ""}${isFailed ? " failed" : ""}${isRegenerating ? " regenerating" : ""}`}
                    style={{ aspectRatio: cssAspectRatio(job.config.aspectRatio) }}
                    onClick={() => {
                      if (isRegenerating) return;
                      setSelectedIndex(isSelected ? null : i);
                      if (!isSelected) setEditText("");
                    }}
                  >
                    <BeforeAfterSlider
                      index={i}
                      beforeSrc={`/api/jobs/${id}/sources/${i}`}
                      afterSrc={`/api/jobs/${id}/frames/${i}${vParam}`}
                      ratio={job.config.aspectRatio}
                      className="review-ba-slider"
                    />
                    {!isRegenerating && !isFailed && (
                      <>
                        <button
                          type="button"
                          className="zoom-btn zoom-btn-before"
                          aria-label={`Zoom source photo for frame ${i + 1}`}
                          title="Zoom before photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({ index: i, kind: "before" });
                          }}
                        >
                          <Icon icon={ZoomInAreaIcon} size={16} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="zoom-btn zoom-btn-after"
                          aria-label={`Zoom generated frame ${i + 1}`}
                          title="Zoom generated frame"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({ index: i, kind: "after" });
                          }}
                        >
                          <Icon icon={ZoomInAreaIcon} size={16} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                    {!isRegenerating && !isFailed && (
                      judgement ? (
                        <span
                          className={`${styles["score-badge"]} ${judgement.passed ? styles.pass : styles.fail}`}
                          title={judgement.rationale}
                        >
                          {judgement.passed && <Icon icon={CheckmarkBadge02Icon} size={13} strokeWidth={1.8} />}
                          <span className={styles["score-num"]}>{judgement.consistencyScore}</span>
                          consistency
                          {judgement.flaggedIssues.length > 0 && (
                            <span className={`${styles["score-flag"]} ${styles["icon-inline"]}`}>
                              · <Icon icon={Alert02Icon} size={12} strokeWidth={1.8} /> {judgement.flaggedIssues.length}
                            </span>
                          )}
                        </span>
                      ) : job.judgeEnabled !== false && !isTimestampStale(imageStep?.updatedAt ?? job.updatedAt, JUDGE_PENDING_WINDOW_MS) ? (
                        <span className={`${styles["score-badge"]} ${styles.pending}`}>Scoring…</span>
                      ) : null
                    )}
                    {isRegenerating && (
                      <div className="loader-overlay">
                        <div className="loader-spinner" />
                        <span>Rendering…</span>
                      </div>
                    )}
                    {isFailed && (
                      <div className="error-overlay"><span>Failed — click to retry</span></div>
                    )}
                    <div className="tile-label">Frame {i + 1}</div>
                  </div>
                );
              })}
            </div>

            {selectedIndex !== null && !localRegen.includes(selectedIndex) && (
              <div className="edit-panel">
                <label className="edit-panel-label">
                  Edit Frame {selectedIndex + 1}
                  <span className="fineprint"> — describe changes to append to the original prompt</span>
                </label>
                {(() => {
                  const j = job.frameJudgements?.[selectedIndex] ?? null;
                  if (!j) return null;
                  return (
                    <div className={styles.findings}>
                      <div className={styles["findings-head"]}>
                        <span className={j.passed ? styles["head-score-pass"] : styles["head-score-fail"]}>
                          Consistency {j.consistencyScore}/100 · {j.passed ? "Pass" : "Below threshold"} ({j.threshold})
                        </span>
                        <span className={styles["sub-scores"]}>
                          geometry {j.geometryPreserved} · perspective {j.perspectivePreserved}
                        </span>
                      </div>
                      {j.rationale && <p className={styles.rationale}>{j.rationale}</p>}
                      {j.flaggedIssues.length > 0 ? (
                        <ul className={styles["issue-list"]}>
                          {j.flaggedIssues.map((issue, k) => <li key={k}>{issue}</li>)}
                        </ul>
                      ) : (
                        <p className={styles["no-issues"]}>No structural issues flagged.</p>
                      )}
                    </div>
                  );
                })()}
                <textarea
                  className="edit-textarea"
                  rows={5}
                  placeholder="e.g. make the rug blue, add more natural light, remove clutter from the table…"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="edit-actions">
                  <button
                    className="ghost-btn"
                    onClick={() => { setSelectedIndex(null); setEditText(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="regen-btn"
                    onClick={submitRegen}
                    disabled={!editText.trim() || submitting}
                  >
                    {submitting ? "Submitting…" : "Regenerate this frame"}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {job && completedFrameCount > 0 && !isReviewMode ? (
          <section className="glass-panel">
            <h2>Before &amp; After</h2>
            <p className="fineprint" style={{ marginTop: -8, marginBottom: 16 }}>Drag to compare</p>
            <div className="ba-slider-grid">
              {job.generatedFrames.map((framePath, i) => {
                if (!framePath) return null;
                const imageStep = job.steps.find((s) => s.kind === "image" && s.index === i);
                const vParam = imageStep?.updatedAt ? `?v=${encodeURIComponent(imageStep.updatedAt)}` : "";
                return (
                  <BeforeAfterSlider
                    key={i}
                    index={i}
                    beforeSrc={`/api/jobs/${id}/sources/${i}`}
                    afterSrc={`/api/jobs/${id}/frames/${i}${vParam}`}
                    ratio={job.config.aspectRatio}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {job && completedClipCount > 0 ? (
          <section className="glass-panel">
            <h2>Clips</h2>
            <div className="clips-list">
              {job.generatedClips.map((clipPath, i) => {
                if (!clipPath) return null;
                const clipStep = job.steps.find((s) => s.kind === "video" && s.index === i);
                return (
                  <div className="clip-item" key={i}>
                    <div className="clip-header">
                      <span className="clip-label">Clip {i + 1}</span>
                      {clipStep && (
                        <span className={`pill ${clipStep.status}`}>{clipStep.status}</span>
                      )}
                    </div>
                    <video
                      className="clip-player"
                      src={`/api/jobs/${id}/clips/${i}`}
                      controls
                      playsInline
                      style={{ aspectRatio: cssAspectRatio(job.config.aspectRatio) }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {job?.finalVideoPath ? (
          <section className="glass-panel">
            <h2>Final Video</h2>
            <video
              className="clip-player"
              src={`/api/jobs/${id}/download`}
              controls
              playsInline
              style={{ width: "100%", borderRadius: 12 }}
            />
          </section>
        ) : null}

        <section className="glass-panel">
          <h2>Timeline</h2>
          <div className="steps">
            {job?.steps.map((step) => (
              <div className="step" key={step.id}>
                <span className={`pill ${step.status}`}>{step.status}</span>
                <strong>{step.label}</strong>
                <span className={`fineprint ${styles["step-kind"]}`}>
                  <Icon icon={STEP_KIND_ICONS[step.kind]} size={14} />
                  <span>{step.kind}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {lightboxFrame && job ? (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged view of ${lightboxFrame.kind === "before" ? "source photo" : "generated frame"} ${lightboxFrame.index + 1}`}
        >
          <button
            type="button"
            className="lightbox-close"
            aria-label="Close enlarged view"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <Icon icon={Cancel01Icon} size={20} strokeWidth={1.75} />
          </button>
          <div
            className="lightbox-figure"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              className="lightbox-img"
              src={
                lightboxFrame.kind === "before"
                  ? `/api/jobs/${id}/sources/${lightboxFrame.index}`
                  : `/api/jobs/${id}/frames/${lightboxFrame.index}${
                      lightboxFrame.step?.updatedAt
                        ? `?v=${encodeURIComponent(lightboxFrame.step.updatedAt)}`
                        : ""
                    }`
              }
              alt={`${lightboxFrame.kind === "before" ? "Source photo" : "Generated frame"} ${lightboxFrame.index + 1}`}
            />
          </div>
          <div className="lightbox-caption">
            {lightboxFrame.kind === "before" ? "Before" : "After"} · Frame {lightboxFrame.index + 1}
          </div>
        </div>
      ) : null}
    </div>
  );
}
