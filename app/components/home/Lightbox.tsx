"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";

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
      <button type="button" className="lightbox-close" aria-label="Close enlarged view" onClick={e => { e.stopPropagation(); setIndex(null); }}>
        <Icon icon={Cancel01Icon} size={20} strokeWidth={1.75} />
      </button>
      {previewUrls.length > 1 && (
        <button type="button" className="lightbox-nav prev" disabled={index === 0} aria-label="Previous image" onClick={e => { e.stopPropagation(); setIndex(i => (i === null ? null : Math.max(i - 1, 0))); }}>
          <Icon icon={ArrowLeft01Icon} size={22} strokeWidth={1.75} />
        </button>
      )}
      <img className="lightbox-img" src={previewUrls[index]} alt={files[index]?.name ?? `Photo ${index + 1}`} onClick={e => e.stopPropagation()} />
      {previewUrls.length > 1 && (
        <button type="button" className="lightbox-nav next" disabled={index === previewUrls.length - 1} aria-label="Next image" onClick={e => { e.stopPropagation(); setIndex(i => (i === null ? null : Math.min(i + 1, previewUrls.length - 1))); }}>
          <Icon icon={ArrowRight01Icon} size={22} strokeWidth={1.75} />
        </button>
      )}
      {previewUrls.length > 1 && (
        <div className="lightbox-counter">{index + 1} / {previewUrls.length}</div>
      )}
    </div>
  );
}
