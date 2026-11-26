import styles from "./layout.module.css";

// Backdrop shared by the job page and its loading state. Keeping it in the
// layout means it is on screen the instant a job link is clicked and the video
// keeps playing when the real page replaces the skeleton.
export default function JobLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className={styles.underlay} aria-hidden="true" />
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
      {children}
    </>
  );
}
