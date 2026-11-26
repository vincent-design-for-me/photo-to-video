import styles from "./loading.module.css";

const STATUS_LABELS = ["Source images", "Generated frames", "Kling clips", "Final render"];

// Shown immediately on navigation while the server loads the job. It mirrors
// the top of JobClient (same shared job-page classes) so nothing shifts when
// the real content replaces it.
export default function JobLoading() {
  return (
    <div className="page">
      <main className="job-main" aria-busy="true">
        <div className="job-topbar">
          <div>
            <span className="eyebrow">Production job</span>
            <h1>Loading</h1>
            <p className="fineprint">
              <span className={`${styles.bar} ${styles.line}`} aria-hidden="true" />
            </p>
          </div>
        </div>

        <section className="glass-panel">
          <h2>Run status</h2>
          <div className="status-grid">
            {STATUS_LABELS.map((label) => (
              <div key={label} className="status-card">
                <span className="label">{label}</span>
                <span className={`${styles.bar} ${styles.value}`} aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
