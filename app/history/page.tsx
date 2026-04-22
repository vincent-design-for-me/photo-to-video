import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJobsByUser } from "@/lib/jobs/store";
import type { VideoJob } from "@/lib/jobs/types";

function statusColor(s: string) {
  if (s === "complete") return "complete";
  if (s === "failed") return "failed";
  if (s === "running" || s === "awaiting_review") return "running";
  return "queued";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let jobs: VideoJob[] = [];
  try {
    jobs = await getJobsByUser(user.id);
  } catch {
    // store may not be configured yet
  }

  return (
    <div className="page">
      <video className="bg-video" src="/bg.mp4" autoPlay muted loop playsInline />
      <div className="bg-video-overlay" />
      <main className="job-main page-enter">
        <div className="job-topbar">
          <div>
            <span className="eyebrow">Your Projects</span>
            <h1>History</h1>
          </div>
          <a href="/" className="job-action">+ New Video</a>
        </div>

        {jobs.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "60px 28px" }}>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>
              No videos yet
            </p>
            <a href="/" className="job-action">Create your first video</a>
          </div>
        ) : (
          <div className="history-grid">
            {jobs.map((job) => (
              <a key={job.id} href={`/jobs/${job.id}`} className="history-card glass-panel">
                <div className="history-thumb">
                  {job.sourceImages?.[0] ? (
                    <img src={`/api/jobs/${job.id}/sources/0`} alt="" />
                  ) : (
                    <div className="history-thumb-empty">No preview</div>
                  )}
                </div>
                <div className="history-info">
                  <span className={`pill ${statusColor(job.status)}`}>{job.status}</span>
                  <span className="history-style">{job.config?.style || "Default"}</span>
                  <span className="history-date">{fmtDate(job.createdAt)}</span>
                  <span className="history-count">
                    {job.sourceImages?.length || 0} photo{(job.sourceImages?.length || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
