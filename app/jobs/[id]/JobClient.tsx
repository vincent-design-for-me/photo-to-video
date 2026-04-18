"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JobStep = {
  id: string;
  kind: "prompt" | "image" | "video" | "render";
  index: number;
  label: string;
  status: "queued" | "running" | "complete" | "failed";
  updatedAt?: string;
};

type JobPayload = {
  id: string;
  status: "queued" | "running" | "awaiting_review" | "complete" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
  sourceImages: { name: string }[];
  generatedFrames: string[];
  framePrompts?: string[];
  generatedClips: string[];
  finalVideoPath?: string;
  config: { aspectRatio: string };
  steps: JobStep[];
};

function cssAspectRatio(ratio: string): string {
  return ratio.replace(":", " / ");
}

export default function JobClient({ id }: { id: string }) {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  // Tracks indices we submitted regen for locally — gives immediate loading state
  const [localRegen, setLocalRegen] = useState<number[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as JobPayload;
        if (active) {
          setJob(payload);
          setError("");
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
      }
    }

    load();
    const interval = setInterval(load, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  async function retry() {
    await fetch(`/api/jobs/${id}/run`, { method: "POST" });
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
  const anyFrameRunning =
    (job?.steps.some((s) => s.kind === "image" && s.status === "running") ?? false) ||
    localRegen.length > 0;

  return (
    <main className="job-page">
      <div className="topbar">
        <div>
          <span className="eyebrow">Production job</span>
          <h1>{job ? job.status.replace("_", " ") : "Loading"}</h1>
          <p className="fineprint">Job ID: {id}</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/">New run</Link>
          {job?.status === "failed" ? <button className="button" onClick={retry}>Retry</button> : null}
          {job?.status === "complete" ? <a className="button" href={`/api/jobs/${id}/download`}>Download MP4</a> : null}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {job?.error ? <p className="error">{job.error}</p> : null}

      <section className="panel">
        <h2>Run status</h2>
        <div className="status-grid">
          <div className="status-card"><span className="label">Source images</span><span className="value">{job?.sourceImages.length ?? 0}</span></div>
          <div className="status-card"><span className="label">Generated frames</span><span className="value">{job?.generatedFrames.length ?? 0}</span></div>
          <div className="status-card"><span className="label">Kling clips</span><span className="value">{job?.generatedClips.length ?? 0}</span></div>
          <div className="status-card"><span className="label">Final render</span><span className="value">{job?.finalVideoPath ? "Ready" : "Pending"}</span></div>
        </div>
      </section>

      {isReviewMode && job ? (
        <section className="panel">
          <div className="review-header">
            <div>
              <h2>Review Generated Frames</h2>
              <p className="fineprint">Click any image to edit its prompt. Select a tile, describe changes, and hit Regenerate.</p>
            </div>
            <button
              className="button review-approve-btn"
              onClick={approveAndGenerate}
              disabled={anyFrameRunning || approving}
            >
              {approving ? "Starting…" : anyFrameRunning ? "Waiting for edits…" : "Generate Video →"}
            </button>
          </div>

          <div className="review-grid">
            {job.generatedFrames.map((_, i) => {
              const imageStep = job.steps.find((s) => s.kind === "image" && s.index === i);
              const isServerRunning = imageStep?.status === "running";
              const isRegenerating = isServerRunning || localRegen.includes(i);
              const isFailed = imageStep?.status === "failed" && !isRegenerating;
              const isSelected = selectedIndex === i;
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
                  <img
                    src={`/api/jobs/${id}/frames/${i}${vParam}`}
                    alt={`Generated frame ${i + 1}`}
                  />
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
              <textarea
                className="edit-textarea"
                rows={5}
                placeholder="e.g. make the rug blue, add more natural light, remove clutter from the table…"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="edit-actions">
                <button
                  className="button secondary"
                  onClick={() => { setSelectedIndex(null); setEditText(""); }}
                >
                  Cancel
                </button>
                <button
                  className="button"
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

      {!isReviewMode && job && job.generatedFrames.length > 0 ? (
        <section className="panel">
          <h2>Before &amp; After</h2>
          <div className="before-after-list">
            {job.generatedFrames.map((_, i) => (
              <div className="before-after-pair" key={i}>
                <div className="ba-side">
                  <span className="ba-label">Before</span>
                  <img
                    className="ba-img"
                    src={`/api/jobs/${id}/sources/${i}`}
                    alt={`Source image ${i + 1}`}
                    loading="lazy"
                  />
                </div>
                <div className="ba-arrow">→</div>
                <div className="ba-side">
                  <span className="ba-label">After</span>
                  <img
                    className="ba-img"
                    src={`/api/jobs/${id}/frames/${i}`}
                    alt={`Generated frame ${i + 1}`}
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Timeline</h2>
        <div className="steps">
          {job?.steps.map((step) => (
            <div className="step" key={step.id}>
              <span className={`pill ${step.status}`}>{step.status}</span>
              <strong>{step.label}</strong>
              <span className="fineprint">{step.kind}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
