"use client";

import type { Dispatch, SetStateAction } from "react";

export function Lightbox({
  index,
  previewUrls,
  files,
  setIndex,
}: {
  index: number;
  previewUrls: string[];
  files: File[];
  setIndex: Dispatch<SetStateAction<number | null>>;
}) {
  return (
    <div
      className="lightbox-backdrop"
      onClick={() => setIndex(null)}
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged view of photo ${index + 1}`}
    >
      <button type="button" className="lightbox-close" aria-label="Close enlarged view" onClick={e => { e.stopPropagation(); setIndex(null); }}>×</button>
      {previewUrls.length > 1 && (
        <button type="button" className="lightbox-nav prev" disabled={index === 0} aria-label="Previous image" onClick={e => { e.stopPropagation(); setIndex(i => (i === null ? null : Math.max(i - 1, 0))); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}
      <img className="lightbox-img" src={previewUrls[index]} alt={files[index]?.name ?? `Photo ${index + 1}`} onClick={e => e.stopPropagation()} />
      {previewUrls.length > 1 && (
        <button type="button" className="lightbox-nav next" disabled={index === previewUrls.length - 1} aria-label="Next image" onClick={e => { e.stopPropagation(); setIndex(i => (i === null ? null : Math.min(i + 1, previewUrls.length - 1))); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}
      {previewUrls.length > 1 && (
        <div className="lightbox-counter">{index + 1} / {previewUrls.length}</div>
      )}
    </div>
  );
}
