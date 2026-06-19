"use client";

import { useCallback, useRef, useState } from "react";

export function GallerySlider({ beforeSrc, afterSrc, label }: { beforeSrc: string; afterSrc: string; label: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const move = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => move(ev.clientX);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [move]);

  return (
    <div
      ref={containerRef}
      className="ba-slider gallery-ba-slider"
      onMouseDown={(e) => { onDragStart(e); move(e.clientX); }}
      onTouchStart={(e) => move(e.touches[0].clientX)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      <img className="ba-slider-img" src={afterSrc} alt={`${label} after`} />
      <img className="ba-slider-img" src={beforeSrc} alt={`${label} before`} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="ba-divider" style={{ left: `${pos}%` }} onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}>
        <div className="ba-handle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6l-6 6 6 6" /><path d="M16 6l6 6-6 6" />
          </svg>
        </div>
      </div>
      <span className="ba-chip ba-chip-left">Before</span>
      <span className="ba-chip ba-chip-right">After</span>
    </div>
  );
}
