"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cancel01Icon, Cursor01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { GallerySlider } from "./GallerySlider";
import { BEFORE_AFTER_PAIRS, GALLERY_COLUMNS, type GalleryTile } from "./landingData";
import styles from "./LandingPage.module.css";

export function GallerySection() {
  const [activeTile, setActiveTile] = useState<GalleryTile | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [isBursting, setIsBursting] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeTile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTile(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTile]);

  const handleOverlayClick = () => {
    if (overlayDismissed) return;
    setIsBursting(true);
    setOverlayDismissed(true);
    revealTimerRef.current = setTimeout(() => {
      setActiveTile(BEFORE_AFTER_PAIRS[0] ?? null);
    }, 320);
  };

  return (
    <section className={styles["gallery-section"]} id="gallery">
      <div className={styles["section-header"]}>
        <span className={styles["section-pill"]}>Gallery</span>
        <h2 className={styles["section-title"]}>Get Inspired</h2>
        <p className={styles["section-subtitle"]}>
          Not sure where to start? Explore a gallery full of real room photos restyled and animated by our AI.
        </p>
        <div className={styles["gallery-actions"]}>
          <Link href="/signup" className={styles["blue-btn"]}>
            <span>Discover More</span>
          </Link>
          <button
            type="button"
            className={styles["ghost-pill-btn"]}
            onClick={() => {
              setOverlayDismissed(true);
              setActiveTile(BEFORE_AFTER_PAIRS[0] ?? null);
            }}
          >
            Compare Before &amp; After
          </button>
        </div>
      </div>

      <div className={styles["gallery-stage"]}>
        <div
          className={`${styles["gallery-marquee-frame"]} ${
            !overlayDismissed ? styles["gallery-marquee-veiled"] : ""
          }`}
        >
          {GALLERY_COLUMNS.map((col, colIdx) => {
            const doubled = [...col, ...col];
            const isReverse = colIdx === 1;
            return (
              <div key={colIdx} className={styles["gallery-col-mask"]}>
                <div
                  className={`${styles["gallery-col-track"]} ${
                    isReverse ? styles["gallery-col-down"] : styles["gallery-col-up"]
                  }`}
                >
                  {doubled.map((tile, itemIdx) => {
                    const hasBefore = Boolean(tile.before);
                    return (
                      <div
                        key={`${colIdx}-${itemIdx}-${tile.label}`}
                        className={styles["gallery-tile"]}
                        onClick={() => setActiveTile(tile)}
                        role="button"
                        tabIndex={overlayDismissed ? 0 : -1}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveTile(tile);
                          }
                        }}
                      >
                        <img src={tile.img} alt={tile.label} className={styles["gallery-tile-img"]} />
                        <div className={styles["gallery-tile-overlay"]}>
                          <span className={styles["gallery-tile-tag"]}>{tile.label}</span>
                          <span className={styles["gallery-tile-compare"]}>
                            {hasBefore ? "Before / After" : "Preview Style"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={`${styles["gallery-click-overlay"]} ${
            overlayDismissed ? styles["gallery-click-overlay-dismissed"] : ""
          }`}
          onClick={handleOverlayClick}
          aria-label="Click to explore interactive gallery and compare before and after transformations"
          aria-hidden={overlayDismissed}
          tabIndex={overlayDismissed ? -1 : 0}
        >
          <span className={styles["gallery-click-halo"]} aria-hidden="true" />
          <span className={styles["gallery-click-cta-wrap"]}>
            <span className={styles["gallery-click-pill-stage"]}>
              <span className={styles["gallery-click-ring"]} aria-hidden="true" />
              <span className={`${styles["gallery-click-ring"]} ${styles["gallery-click-ring-delayed"]}`} aria-hidden="true" />
              {isBursting && <span className={styles["gallery-click-burst"]} aria-hidden="true" />}

              <span className={styles["gallery-click-pill"]}>
                <span className={styles["gallery-click-cursor-badge"]} aria-hidden="true">
                  <span className={styles["gallery-click-tap-dot"]} />
                  <span className={styles["gallery-click-cursor-icon"]}>
                    <Icon icon={Cursor01Icon} size={18} strokeWidth={1.85} />
                  </span>
                </span>
                <span className={styles["gallery-click-label"]}>Click Me</span>
              </span>
            </span>

            <span className={styles["gallery-click-hint"]}>
              Explore Before &amp; After Transformations
            </span>
          </span>
        </button>
      </div>

      {activeTile && (
        <div
          className={styles["compare-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-label={
            activeTile.before
              ? `Before and after comparison for ${activeTile.label}`
              : `${activeTile.label} style preview`
          }
          onClick={() => setActiveTile(null)}
        >
          <div className={styles["compare-modal"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["compare-modal-head"]}>
              <div className={styles["compare-tabs"]}>
                {BEFORE_AFTER_PAIRS.map((pair) => (
                  <button
                    key={pair.label}
                    type="button"
                    className={`${styles["compare-tab"]} ${
                      pair.label === activeTile.label ? styles["compare-tab-active"] : ""
                    }`}
                    onClick={() => setActiveTile(pair)}
                  >
                    {pair.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles["compare-close"]}
                onClick={() => setActiveTile(null)}
                aria-label="Close comparison"
              >
                <Icon icon={Cancel01Icon} size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className={styles["compare-slider-wrap"]}>
              {activeTile.before ? (
                <GallerySlider
                  beforeSrc={activeTile.before}
                  afterSrc={activeTile.img}
                  label={activeTile.label}
                />
              ) : (
                <>
                  <img
                    src={activeTile.img}
                    alt={activeTile.label}
                    className={styles["compare-preview-img"]}
                  />
                  <span className={styles["compare-preview-badge"]}>{activeTile.label}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
