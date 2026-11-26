"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  AiMagicIcon,
  Alert02Icon,
  ArrowRight02Icon,
  BookOpen02Icon,
  CheckmarkBadge02Icon,
  ClapperboardIcon,
  Download04Icon,
  GridViewIcon,
  LeftToRightListDashIcon,
  Loading03Icon,
  Search01Icon,
  VideoReplayIcon,
  Cancel01Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { StylePickerGrid } from "./StylePickerGrid";
import type { WorkspaceJobSummary } from "./types";
import styles from "./WorkspaceCanvas.module.css";

type FilterValue = "all" | "awaiting_review" | "complete" | "running" | "failed";

type WorkspaceCanvasProps = {
  activeTab: "history" | "guide";
  onTabChange: (tab: "history" | "guide") => void;
  pickingStyle: boolean;
  selectedStyle: string;
  onSelectStyle: (styleId: string) => void;
  onCloseStylePicker: () => void;
  jobs: WorkspaceJobSummary[];
  loadingJobs: boolean;
};

const GUIDE_STEPS = [
  {
    num: "01",
    title: "Add room photos",
    desc: "Upload 1–6 real property photos or reuse past uploads. Tap any thumbnail’s pencil icon to add per-room edits.",
    img: "/gallery/Japandi-before.png",
  },
  {
    num: "02",
    title: "Pick an interior style",
    desc: "Preview 8 curated design aesthetics in the canvas. Your walls, windows, and room geometry stay strictly locked.",
    img: "/gallery/Japandi.png",
  },
  {
    num: "03",
    title: "Review frames & export",
    desc: "Compare before/after sliders with automated consistency scores, refine any frame, then render your vertical MP4.",
    img: "/gallery/Luxury Modern.png",
  },
];

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusClass(status: WorkspaceJobSummary["status"]): string {
  if (status === "complete") return styles["status-complete"];
  if (status === "awaiting_review") return styles["status-review"];
  if (status === "running") return styles["status-running"];
  if (status === "failed") return styles["status-failed"];
  return styles["status-queued"];
}

function statusLabel(status: WorkspaceJobSummary["status"]): string {
  if (status === "awaiting_review") return "Ready to review";
  if (status === "running") return "Generating";
  return status;
}

function activeStepText(job: WorkspaceJobSummary): string {
  if (job.status === "complete") return "Final video is ready to watch and download.";
  if (job.status === "awaiting_review") return "Frames generated — review and approve to render video.";
  if (job.status === "failed") return job.error || "A step failed — open to resume from checkpoint.";
  const running = job.steps.find((s) => s.status === "running");
  if (running) return running.label;
  if (job.optimistic) return "Uploading assets and starting AI pipeline…";
  return "Queued — starting AI pipeline…";
}

function primaryCtaLabel(status: WorkspaceJobSummary["status"]): string {
  if (status === "awaiting_review") return "Review frames";
  if (status === "complete") return "Open video";
  if (status === "failed") return "Open & retry";
  return "View progress";
}

function previewUrlForJob(job: WorkspaceJobSummary): { kind: "video" | "image" | "none"; src?: string } {
  if (job.optimistic) return { kind: "none" };
  if (job.status === "complete" && job.finalVideoPath) {
    return { kind: "video", src: `/api/jobs/${job.id}/download` };
  }
  const firstFrameIdx = job.generatedFrames.findIndex(Boolean);
  if (firstFrameIdx >= 0) {
    return { kind: "image", src: `/api/jobs/${job.id}/frames/${firstFrameIdx}` };
  }
  if (job.sourceImages.length > 0) {
    return { kind: "image", src: `/api/jobs/${job.id}/sources/0` };
  }
  return { kind: "none" };
}

export function WorkspaceCanvas({
  activeTab,
  onTabChange,
  pickingStyle,
  selectedStyle,
  onSelectStyle,
  onCloseStylePicker,
  jobs,
  loadingJobs,
}: WorkspaceCanvasProps) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [query, setQuery] = useState("");

  // When a brand-new job is created optimistically, ensure it is visible immediately.
  const latestOptimisticId = jobs[0]?.optimistic ? jobs[0].id : null;
  useEffect(() => {
    if (!latestOptimisticId) return;
    setFilter("all");
    setQuery("");
  }, [latestOptimisticId]);

  const counts = useMemo(() => {
    return {
      all: jobs.length,
      awaiting_review: jobs.filter((j) => j.status === "awaiting_review").length,
      complete: jobs.filter((j) => j.status === "complete").length,
      running: jobs.filter((j) => j.status === "running" || j.status === "queued").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    };
  }, [jobs]);

  const effectiveFilter: FilterValue =
    (filter === "running" && counts.running === 0) ||
    (filter === "failed" && counts.failed === 0)
      ? "all"
      : filter;

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (effectiveFilter === "running") {
        if (job.status !== "running" && job.status !== "queued") return false;
      } else if (effectiveFilter !== "all" && job.status !== effectiveFilter) {
        return false;
      }
      if (!q) return true;
      const styleMatch = (job.config?.style ?? "").toLowerCase().includes(q);
      const idMatch = job.id.toLowerCase().includes(q);
      const fileMatch = job.sourceImages.some((s) => s.name.toLowerCase().includes(q));
      return styleMatch || idMatch || fileMatch;
    });
  }, [jobs, effectiveFilter, query]);

  const filterTabs: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.all },
    { value: "awaiting_review", label: "Ready to review", count: counts.awaiting_review },
    { value: "complete", label: "Complete", count: counts.complete },
    ...(counts.running > 0 ? [{ value: "running" as const, label: "Generating", count: counts.running }] : []),
    ...(counts.failed > 0 ? [{ value: "failed" as const, label: "Failed", count: counts.failed }] : []),
  ];

  if (pickingStyle) {
    return (
      <section className={styles.canvas} aria-label="Style preset picker">
        <div className={styles.body}>
          <StylePickerGrid
            selectedStyle={selectedStyle}
            onSelect={onSelectStyle}
            onClose={onCloseStylePicker}
          />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.canvas} aria-label="Workspace canvas">
      <Tabs.Root
        className={styles["tabs-root"]}
        value={activeTab}
        onValueChange={(v) => onTabChange(v as "history" | "guide")}
      >
        <div className={styles.topbar}>
          <Tabs.List className={styles["tab-list"]} aria-label="Workspace views">
            <Tabs.Trigger value="history" className={styles["tab-trigger"]}>
              <Icon icon={VideoReplayIcon} size={15} />
              <span>History</span>
              <span className={styles["tab-badge"]}>{jobs.length}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="guide" className={styles["tab-trigger"]}>
              <Icon icon={BookOpen02Icon} size={15} />
              <span>How it works</span>
            </Tabs.Trigger>
          </Tabs.List>

          {activeTab === "history" && jobs.length > 0 && (
            <div className={styles["view-controls"]} role="group" aria-label="Layout view">
              <button
                type="button"
                className={`${styles["view-btn"]}${viewMode === "list" ? ` ${styles["view-btn-active"]}` : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
                title="List view"
              >
                <Icon icon={LeftToRightListDashIcon} size={15} />
              </button>
              <button
                type="button"
                className={`${styles["view-btn"]}${viewMode === "grid" ? ` ${styles["view-btn-active"]}` : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                title="Grid view"
              >
                <Icon icon={GridViewIcon} size={15} />
              </button>
            </div>
          )}
        </div>

        {activeTab === "history" && jobs.length > 0 && (
          <div className={styles["history-toolbar"]}>
            <div className={styles["filter-list"]} role="tablist" aria-label="Filter projects by status">
              {filterTabs.map((tab) => {
                const isActive = effectiveFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-state={isActive ? "active" : "inactive"}
                    className={styles["filter-trigger"]}
                    onClick={() => setFilter(tab.value)}
                  >
                    <span>{tab.label}</span>
                    <span className={styles["filter-count"]}>{tab.count}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles["search-wrap"]}>
              <Icon icon={Search01Icon} size={14} className={styles["search-icon"]} />
              <input
                type="text"
                className={styles["search-input"]}
                placeholder="Search style or photo…"
                aria-label="Search style or photo"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className={styles["search-clear"]}
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <Icon icon={Cancel01Icon} size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.body}>
          <Tabs.Content value="history">
            {loadingJobs && jobs.length === 0 ? (
              <div className={styles["empty-history"]}>
                <Icon icon={Loading03Icon} size={22} className={styles.spinner} />
                <p className={styles["empty-history-sub"]}>Loading your recent projects…</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className={styles["empty-history"]}>
                <Icon icon={ClapperboardIcon} size={30} />
                <h2 className={styles["empty-history-title"]}>No generated videos yet</h2>
                <p className={styles["empty-history-sub"]}>
                  Drop 1–6 room photos in the left panel, choose an interior style, and hit Generate Video.
                </p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className={styles["empty-history"]}>
                <h2 className={styles["empty-history-title"]}>No matching projects</h2>
                <p className={styles["empty-history-sub"]}>
                  Try clearing your search or switching status filters.
                </p>
                <button
                  type="button"
                  className={styles["clear-filters-btn"]}
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : viewMode === "list" ? (
              <div className={styles["history-list"]}>
                {filteredJobs.map((job) => {
                  const preview = previewUrlForJob(job);
                  const isGenerating = job.status === "running" || job.status === "queued";

                  return (
                    <article key={job.id} className={styles["job-row"]}>
                      <Link href={`/jobs/${job.id}`} className={styles["job-media"]}>
                        {preview.kind === "video" && preview.src ? (
                          <video
                            src={preview.src}
                            className={styles["job-media-el"]}
                            muted
                            loop
                            playsInline
                            onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}); }}
                            onMouseLeave={(e) => { e.currentTarget.pause(); }}
                          />
                        ) : preview.kind === "image" && preview.src ? (
                          <img src={preview.src} alt={job.config.style} className={styles["job-media-el"]} />
                        ) : (
                          <div className={styles["job-media-placeholder"]}>
                            <Icon icon={AiMagicIcon} size={22} />
                            <span>Preparing workspace…</span>
                          </div>
                        )}

                        {isGenerating && (
                          <div className={styles["generating-overlay"]}>
                            <Icon icon={Loading03Icon} size={20} className={styles.spinner} />
                            <span>Generating…</span>
                          </div>
                        )}
                      </Link>

                      <div className={styles["job-meta"]}>
                        <div className={styles["job-meta-top"]}>
                          <div className={styles["job-status-row"]}>
                            <span className={`${styles["status-badge"]} ${statusClass(job.status)}`}>
                              {isGenerating && <Icon icon={Loading03Icon} size={11} className={styles.spinner} />}
                              {job.status === "complete" && <Icon icon={CheckmarkBadge02Icon} size={12} />}
                              {job.status === "failed" && <Icon icon={Alert02Icon} size={12} />}
                              {statusLabel(job.status)}
                            </span>
                            <span className={styles["job-date"]}>{formatDate(job.createdAt)}</span>
                          </div>

                          <h3 className={styles["job-title"]}>{job.config?.style || "Interior Video"}</h3>
                          <p className={styles["job-step-line"]}>{activeStepText(job)}</p>

                          <div className={styles["chips-row"]}>
                            <span className={styles.chip}>{job.config?.aspectRatio || "3:4"}</span>
                            <span className={styles.chip}>{job.config?.resolution || "1080p"}</span>
                            <span className={styles.chip}>
                              {job.sourceImages.length} photo{job.sourceImages.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          {!job.optimistic && job.sourceImages.length > 0 && (
                            <div className={styles["source-strip"]}>
                              {job.sourceImages.slice(0, 4).map((src, idx) => (
                                <img
                                  key={`${job.id}-src-${idx}`}
                                  src={`/api/jobs/${job.id}/sources/${idx}`}
                                  alt={src.name}
                                  className={styles["source-mini"]}
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className={styles["job-meta-footer"]}>
                          <Link href={`/jobs/${job.id}`} className={styles["job-cta"]}>
                            <span>{primaryCtaLabel(job.status)}</span>
                            <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.75} />
                          </Link>
                          {job.status === "complete" && job.finalVideoPath && (
                            <a
                              href={`/api/jobs/${job.id}/download?download=1`}
                              className={styles["job-cta-outline"]}
                            >
                              <Icon icon={Download04Icon} size={13} />
                              MP4
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles["history-grid"]}>
                {filteredJobs.map((job) => {
                  const preview = previewUrlForJob(job);
                  const isGenerating = job.status === "running" || job.status === "queued";
                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`} className={styles["grid-card"]}>
                      <div className={styles["grid-card-media"]}>
                        {preview.kind === "video" && preview.src ? (
                          <video src={preview.src} className={styles["job-media-el"]} muted playsInline />
                        ) : preview.kind === "image" && preview.src ? (
                          <img src={preview.src} alt={job.config.style} className={styles["job-media-el"]} />
                        ) : (
                          <div className={styles["job-media-placeholder"]}>
                            <Icon icon={AiMagicIcon} size={20} />
                          </div>
                        )}
                        {isGenerating && (
                          <div className={styles["generating-overlay"]}>
                            <Icon icon={Loading03Icon} size={18} className={styles.spinner} />
                            <span>Generating…</span>
                          </div>
                        )}
                      </div>
                      <div className={styles["grid-card-body"]}>
                        <div className={styles["job-status-row"]}>
                          <span className={`${styles["status-badge"]} ${statusClass(job.status)}`}>
                            {isGenerating && <Icon icon={Loading03Icon} size={11} className={styles.spinner} />}
                            {job.status === "complete" && <Icon icon={CheckmarkBadge02Icon} size={12} />}
                            {job.status === "failed" && <Icon icon={Alert02Icon} size={12} />}
                            {statusLabel(job.status)}
                          </span>
                          <span className={styles["job-date"]}>{formatDate(job.createdAt)}</span>
                        </div>
                        <h3 className={styles["job-title"]}>{job.config?.style || "Interior Video"}</h3>
                        <div className={styles["chips-row"]}>
                          <span className={styles.chip}>{job.config?.aspectRatio || "3:4"}</span>
                          <span className={styles.chip}>{job.config?.resolution || "1080p"}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="guide">
            <div className={styles["guide-wrap"]}>
              <div className={styles["guide-header"]}>
                <span className={styles["guide-eyebrow"]}>Interior video studio</span>
                <h2 className={styles["guide-title"]}>Turn room photos into cinematic videos</h2>
                <p className={styles["guide-sub"]}>
                  Drop your photos on the left, pick a curated style, and review every restyled frame before video generation starts.
                </p>
              </div>

              <div className={styles["steps-grid"]}>
                {GUIDE_STEPS.map((step) => (
                  <div key={step.num} className={styles["step-card"]}>
                    <div className={styles["step-media"]}>
                      <img src={step.img} alt={step.title} className={styles["step-img"]} />
                      <span className={styles["step-num"]}>{step.num}</span>
                    </div>
                    <div className={styles["step-body"]}>
                      <h3 className={styles["step-title"]}>{step.title}</h3>
                      <p className={styles["step-desc"]}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles["guide-banner"]}>
                <div className={styles["guide-banner-text"]}>
                  <h3 className={styles["guide-banner-title"]}>Not sure which look fits your listing?</h3>
                  <p className={styles["guide-banner-sub"]}>
                    Explore 459+ real interior prompt examples in our curated Prompt Library.
                  </p>
                </div>
                <Link href="/library" className={styles["guide-banner-link"]}>
                  <span>Browse Prompt Library</span>
                  <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </section>
  );
}
