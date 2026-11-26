"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  AudioWave01Icon,
  ColorPickerIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { FEATURE_CARDS, HERO_TICKER_TILES, type FeatureCardId } from "./landingData";
import styles from "./LandingPage.module.css";

function FeatureCardVisual({ id, image, title }: { id: FeatureCardId; image: string; title: string }) {
  if (id === "resolution") {
    return (
      <div className={styles["feature-visual"]}>
        <img src={image} alt={title} className={styles["feature-photo"]} />
        <div className={styles["feature-photo-scrim"]} aria-hidden="true" />
        <div className={styles["glass-dropdown"]} aria-hidden="true">
          <div className={styles["glass-dropdown-head"]}>
            <span>Download</span>
            <span className={styles["glass-dropdown-caret"]}>
              <Icon icon={ArrowUp01Icon} size={16} strokeWidth={1.75} />
            </span>
          </div>
          <div className={styles["glass-dropdown-list"]}>
            <div className={styles["glass-dropdown-row"]}>
              <strong>HD</strong>
              <span>(1280 &times; 720)</span>
            </div>
            <div className={styles["glass-dropdown-row"]}>
              <strong>Full HD</strong>
              <span>(1920 &times; 1080)</span>
            </div>
            <div className={`${styles["glass-dropdown-row"]} ${styles["glass-dropdown-row-active"]}`}>
              <strong>4K Ultra</strong>
              <span>(3840 &times; 2160)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (id === "adjustments") {
    return (
      <div className={styles["feature-visual"]}>
        <img src={image} alt={title} className={styles["feature-photo"]} />
        <div className={styles["feature-photo-scrim"]} aria-hidden="true" />
        <div className={`${styles["swatch-float"]} ${styles["swatch-float-left"]}`} aria-hidden="true">
          <span className={styles["swatch-pipette"]}>
            <Icon icon={ColorPickerIcon} size={13} strokeWidth={1.75} />
          </span>
          <div className={styles["swatch-card"]}>
            <div className={`${styles["swatch-bar"]} ${styles["swatch-bar-warm"]}`} />
            <span className={styles["swatch-hex"]}>WARM OAK</span>
          </div>
        </div>
        <div className={`${styles["swatch-float"]} ${styles["swatch-float-right"]}`} aria-hidden="true">
          <span className={styles["swatch-pipette"]}>
            <Icon icon={ColorPickerIcon} size={13} strokeWidth={1.75} />
          </span>
          <div className={styles["swatch-card"]}>
            <div className={`${styles["swatch-bar"]} ${styles["swatch-bar-cool"]}`} />
            <span className={styles["swatch-hex"]}>16:9 &middot; JAPANDI</span>
          </div>
        </div>
      </div>
    );
  }

  if (id === "styles") {
    const rowA = [...HERO_TICKER_TILES, ...HERO_TICKER_TILES];
    const rowB = [...HERO_TICKER_TILES.slice(3), ...HERO_TICKER_TILES.slice(0, 3), ...HERO_TICKER_TILES.slice(3), ...HERO_TICKER_TILES.slice(0, 3)];
    return (
      <div className={`${styles["feature-visual"]} ${styles["feature-visual-slate"]}`} aria-hidden="true">
        <div className={styles["style-marquee-stack"]}>
          <div className={styles["style-marquee-row"]}>
            {rowA.map((tile, idx) => (
              <div key={`a-${idx}`} className={styles["style-marquee-thumb"]}>
                <img src={tile.src} alt="" />
              </div>
            ))}
          </div>
          <div className={`${styles["style-marquee-row"]} ${styles["style-marquee-row-rev"]}`}>
            {rowB.map((tile, idx) => (
              <div key={`b-${idx}`} className={styles["style-marquee-thumb"]}>
                <img src={tile.src} alt="" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["feature-visual"]}>
      <img src={image} alt={title} className={styles["feature-photo"]} />
      <div className={styles["feature-photo-scrim"]} aria-hidden="true" />
      <div className={styles["audio-overlay-pill"]} aria-hidden="true">
        <span className={styles["audio-overlay-icon"]}>
          <Icon icon={AudioWave01Icon} size={16} strokeWidth={1.75} />
        </span>
        <div className={styles["audio-overlay-bars"]}>
          <span className={styles["audio-bar-a"]} />
          <span className={styles["audio-bar-b"]} />
          <span className={styles["audio-bar-c"]} />
          <span className={styles["audio-bar-d"]} />
          <span className={styles["audio-bar-b"]} />
          <span className={styles["audio-bar-a"]} />
        </div>
        <span className={styles["audio-overlay-meta"]}>Ambient Piano &middot; 0:47</span>
      </div>
    </div>
  );
}

export function FeaturesCarousel() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollByCard(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(FEATURE_CARDS.length - 1, activeIndex + direction));
    setActiveIndex(next);
    const cardWidth = 579;
    track.scrollTo({ left: next * cardWidth, behavior: "smooth" });
  }

  return (
    <section className={styles["features-section"]} id="features">
      <div className={styles["features-shell"]}>
        <div className={styles["section-header"]}>
          <span className={styles["section-pill"]}>Features</span>
          <h2 className={styles["section-title"]}>
            AI-Powered
            <br />
            Video Creation
          </h2>
        </div>

        <div className={styles["carousel-stage"]}>
          <div
            ref={trackRef}
            className={styles["carousel-track"]}
            role="region"
            aria-label="Product features"
          >
            {FEATURE_CARDS.map((card) => (
              <article key={card.id} className={styles["feature-card"]}>
                <FeatureCardVisual id={card.id} image={card.image} title={card.title} />
                <div className={styles["feature-card-copy"]}>
                  <h3 className={styles["feature-card-title"]}>{card.title}</h3>
                  <p className={styles["feature-card-sub"]}>{card.subtitle}</p>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            className={`${styles["carousel-arrow"]} ${styles["carousel-arrow-prev"]}`}
            onClick={() => scrollByCard(-1)}
            aria-label="Previous feature"
          >
            <Icon icon={ArrowLeft01Icon} size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`${styles["carousel-arrow"]} ${styles["carousel-arrow-next"]}`}
            onClick={() => scrollByCard(1)}
            aria-label="Next feature"
          >
            <Icon icon={ArrowRight01Icon} size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </section>
  );
}
