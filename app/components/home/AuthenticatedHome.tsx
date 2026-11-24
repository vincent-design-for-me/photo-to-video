"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lightbox } from "./Lightbox";
import { STYLE_CARDS } from "./uploadConfig";
import { useUploadJob } from "./useUploadJob";
import { WorkspaceCanvas } from "./workspace/WorkspaceCanvas";
import { WorkspaceRail } from "./workspace/WorkspaceRail";
import type { ReusableAsset, WorkspaceJobSummary } from "./workspace/types";
import styles from "./AuthenticatedHome.module.css";

export function AuthenticatedHome() {
  const [jobs, setJobs] = useState<WorkspaceJobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "guide">("guide");
  const [pickingStyle, setPickingStyle] = useState(false);
  const initialTabChosenRef = useRef(false);
  const fetchInFlightRef = useRef(false);

  const loadJobs = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    fetchInFlightRef.current = true;
    try {
      const response = await fetch("/api/jobs", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { jobs?: WorkspaceJobSummary[] };
      const fetched = data.jobs ?? [];
      setJobs(fetched);
      if (!initialTabChosenRef.current) {
        initialTabChosenRef.current = true;
        setActiveTab(fetched.length > 0 ? "history" : "guide");
      }
    } catch {
      // Keep current jobs visible on transient network blips
    } finally {
      fetchInFlightRef.current = false;
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const hasActiveJob = useMemo(
    () => jobs.some((j) => j.status === "queued" || j.status === "running"),
    [jobs]
  );

  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = setInterval(loadJobs, 3500);
    const onVisible = () => {
      if (!document.hidden) loadJobs();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasActiveJob, loadJobs]);

  const job = useUploadJob({
    onJobCreated: (created) => {
      const styleInfo = STYLE_CARDS.find((s) => s.id === created.styleId);
      const now = new Date().toISOString();
      const optimisticJob: WorkspaceJobSummary = {
        id: created.id,
        status: created.runError ? "failed" : "running",
        createdAt: now,
        updatedAt: now,
        sourceImages: Array.from({ length: created.photoCount }, (_, idx) => ({
          name: `photo-${idx + 1}.jpg`,
          path: "",
        })),
        generatedFrames: [],
        generatedClips: [],
        error: created.runError,
        config: {
          styleId: created.styleId,
          style: styleInfo?.name ?? created.styleId,
          aspectRatio: created.aspectRatio,
          resolution: created.resolution,
        },
        steps: [],
        optimistic: true,
      };
      setJobs((prev) => [optimisticJob, ...prev.filter((j) => j.id !== created.id)]);
      setPickingStyle(false);
      setActiveTab("history");
      initialTabChosenRef.current = true;
      // Refresh real server state shortly after inserting the optimistic placeholder
      setTimeout(() => {
        loadJobs();
      }, 1200);
    },
  });

  // Collect up to 12 recent source photos across past jobs for quick reuse
  const reusableAssets = useMemo<ReusableAsset[]>(() => {
    const out: ReusableAsset[] = [];
    for (const item of jobs) {
      if (item.optimistic) continue;
      for (let i = 0; i < item.sourceImages.length; i += 1) {
        out.push({
          id: `${item.id}:${i}`,
          url: `/api/jobs/${item.id}/sources/${i}`,
          name: item.sourceImages[i].name,
          jobStyle: item.config?.style || "Past project",
        });
        if (out.length >= 12) return out;
      }
    }
    return out;
  }, [jobs]);

  return (
    <div className={styles.shell}>
      <main className={styles.grid}>
        <WorkspaceRail
          job={job}
          pickingStyle={pickingStyle}
          onToggleStylePicker={() => setPickingStyle((prev) => !prev)}
          reusableAssets={reusableAssets}
        />

        <WorkspaceCanvas
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pickingStyle={pickingStyle}
          selectedStyle={job.selectedStyle}
          onSelectStyle={job.setSelectedStyle}
          onCloseStylePicker={() => setPickingStyle(false)}
          jobs={jobs}
          loadingJobs={loadingJobs}
        />
      </main>

      {job.lightboxIndex !== null && job.previewUrls[job.lightboxIndex] && (
        <Lightbox
          index={job.lightboxIndex}
          previewUrls={job.previewUrls}
          files={job.files}
          setIndex={job.setLightboxIndex}
        />
      )}
    </div>
  );
}
