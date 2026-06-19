"use client";

import { Lightbox } from "./Lightbox";
import { MouseParticles } from "./MouseParticles";
import { UploadCard } from "./UploadCard";
import { useUploadJob } from "./useUploadJob";

export function AuthenticatedHome() {
  const job = useUploadJob();

  return (
    <div className="app-page">
      <img className="landing-hero-bg" src="/auth-app-bg.jpg" alt="" aria-hidden="true" />
      <MouseParticles />

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

        <UploadCard job={job} />
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
