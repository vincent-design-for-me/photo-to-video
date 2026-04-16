"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JobStep = {
  id: string;
  kind: "prompt" | "image" | "video" | "render";
  label: string;
  status: "queued" | "running" | "complete" | "failed";
};

type JobPayload = {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
  sourceImages: { name: string }[];
  generatedFrames: string[];
  generatedClips: string[];
  finalVideoPath?: string;
  steps: JobStep[];
};

export default function JobClient({ id }: { id: string }) {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = (await response.json()) as JobPayload;
        if (active) {
          setJob(payload);
          setError("");
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

  return (
    <main className="job-page">
      <div className="topbar">
        <div>
          <span className="eyebrow">Production job</span>
          <h1>{job ? job.status : "Loading"}</h1>
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
