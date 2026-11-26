"use client";

import Link from "next/link";
import {
  AiMagicIcon,
  AiVideoIcon,
  AspectRatioIcon,
  AudioWave01Icon,
  FourKIcon,
  ImageUploadIcon,
  InstagramIcon,
  Lamp01Icon,
  NewTwitterIcon,
  PaintBoardIcon,
  PlayIcon,
  Sofa01Icon,
  StarIcon,
  Timer02Icon,
  TrendingUpIcon,
  UserMultiple02Icon,
  YoutubeIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon, type IconSvgElement } from "@/app/components/Icon";
import { FeaturesCarousel } from "./FeaturesCarousel";
import { GallerySection } from "./GallerySection";
import { PricingSection } from "./PricingSection";
import { StarfieldCanvas } from "./StarfieldCanvas";
import {
  HERO_TICKER_TILES,
  HOW_IT_WORKS_STEPS,
  NAV_LEFT,
  NAV_RIGHT,
  TRUSTED_STRIP_ITEMS,
  type HowItWorksStep,
} from "./landingData";
import styles from "./LandingPage.module.css";

const ORBIT_ICONS: Array<{ id: string; icon: IconSvgElement; angle: number }> = [
  { id: "sofa", icon: Sofa01Icon, angle: 0 },
  { id: "ai-magic", icon: AiMagicIcon, angle: 45 },
  { id: "ai-video", icon: AiVideoIcon, angle: 90 },
  { id: "paint-board", icon: PaintBoardIcon, angle: 135 },
  { id: "audio-wave", icon: AudioWave01Icon, angle: 180 },
  { id: "4k", icon: FourKIcon, angle: 225 },
  { id: "aspect-ratio", icon: AspectRatioIcon, angle: 270 },
  { id: "lamp", icon: Lamp01Icon, angle: 315 },
];

const TRUST_STRIP_ICONS: IconSvgElement[] = [
  AiVideoIcon,
  UserMultiple02Icon,
  TrendingUpIcon,
  StarIcon,
  FourKIcon,
  PaintBoardIcon,
  Timer02Icon,
];

function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5C12.8 7.5 16.5 11.2 21.5 12C16.5 12.8 12.8 16.5 12 21.5C11.2 16.5 7.5 12.8 2.5 12C7.5 11.2 11.2 7.5 12 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PhoneMockup({ step }: { step: HowItWorksStep | "cta" }) {
  if (step === "cta") {
    return (
      <div className={styles["cta-phone"]} aria-hidden="true">
        <div className={styles["phone-screen"]}>
          <div className={styles["phone-topbar"]}>
            <span className={styles["phone-time"]}>9:41</span>
            <span className={styles["phone-island"]} />
            <span className={styles["phone-status-pill"]}>MP4</span>
          </div>

          <div className={styles["cta-phone-preview"]}>
            <img src="/gallery/Japandi.png" alt="" />
            <div className={styles["cta-phone-play"]}>
              <Icon icon={PlayIcon} size={18} fill="currentColor" />
            </div>
            <span className={styles["cta-phone-badge"]}>4K &middot; 0:47</span>
          </div>

          <div className={styles["cta-phone-rows"]}>
            <div className={styles["cta-phone-row"]}>
              <span>Style</span>
              <strong>Japandi Warm</strong>
            </div>
            <div className={styles["cta-phone-row"]}>
              <span>Motion</span>
              <strong>Cinematic Pan</strong>
            </div>
            <div className={styles["cta-phone-row"]}>
              <span>Audio</span>
              <strong>Soft Piano</strong>
            </div>
          </div>

          <div className={styles["phone-cta-pill"]}>Export Ready</div>
        </div>
      </div>
    );
  }

  if (step.id === "upload") {
    return (
      <div className={styles["step-phone"]} aria-hidden="true">
        <div className={styles["phone-screen"]}>
          <div className={styles["phone-topbar"]}>
            <span className={styles["phone-time"]}>9:41</span>
            <span className={styles["phone-island"]} />
            <span className={styles["phone-status-pill"]}>01</span>
          </div>

          <div className={styles["phone-fan-stage"]}>
            <div className={`${styles["phone-fan-card"]} ${styles["phone-fan-left"]}`}>
              <img src="/gallery/Contemporary-before.png" alt="" />
            </div>
            <div className={`${styles["phone-fan-card"]} ${styles["phone-fan-right"]}`}>
              <img src="/gallery/Japandi-before.png" alt="" />
            </div>
            <div className={`${styles["phone-fan-card"]} ${styles["phone-fan-center"]}`}>
              <img src={step.previewImg} alt="" />
            </div>
          </div>

          <div className={styles["phone-chip-row"]}>
            <span className={styles["phone-chip"]}>+ JPEG</span>
            <span className={styles["phone-chip"]}>+ PNG</span>
            <span className={styles["phone-chip"]}>+ WebP</span>
          </div>

          <div className={styles["phone-prompt-box"]}>
            <span className={styles["phone-prompt-text"]}>
              Drop living room, kitchen, and suite shots&hellip;
            </span>
            <div className={styles["phone-prompt-foot"]}>
              <span className={styles["phone-prompt-meta"]}>
                <Icon icon={ImageUploadIcon} size={13} /> 6 rooms added
              </span>
              <span className={styles["phone-send-btn"]}>
                <Icon icon={AiMagicIcon} size={13} />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step.id === "generate") {
    return (
      <div className={styles["step-phone"]} aria-hidden="true">
        <div className={styles["phone-screen"]}>
          <div className={styles["phone-topbar"]}>
            <span className={styles["phone-time"]}>9:41</span>
            <span className={styles["phone-island"]} />
            <span className={styles["phone-status-pill"]}>02</span>
          </div>

          <div className={styles["step-phone-hero-img"]}>
            <img src={step.previewImg} alt="" />
            <span className={styles["step-phone-floating-pill"]}>Restyling &middot; Luxury Modern</span>
          </div>

          <div className={styles["step-phone-progress"]}>
            <div className={styles["step-phone-progress-head"]}>
              <span>Animating shots</span>
              <strong>78%</strong>
            </div>
            <div className={styles["step-phone-bar"]}>
              <div className={styles["step-phone-bar-fill"]} />
            </div>
          </div>

          <div className={styles["phone-chip-row"]}>
            <span className={`${styles["phone-chip"]} ${styles["phone-chip-active"]}`}>Luxury</span>
            <span className={styles["phone-chip"]}>16:9</span>
            <span className={styles["phone-chip"]}>4K</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["step-phone"]} aria-hidden="true">
      <div className={styles["phone-screen"]}>
        <div className={styles["phone-topbar"]}>
          <span className={styles["phone-time"]}>9:41</span>
          <span className={styles["phone-island"]} />
          <span className={styles["phone-status-pill"]}>03</span>
        </div>

        <div className={styles["cta-phone-preview"]}>
          <img src={step.previewImg} alt="" />
          <div className={styles["cta-phone-play"]}>
            <Icon icon={PlayIcon} size={18} fill="currentColor" />
          </div>
          <span className={styles["cta-phone-badge"]}>0:47 &middot; 4K</span>
        </div>

        <div className={styles["step-phone-export-row"]}>
          <span>Listing_Reel_4K.mp4</span>
          <strong>Ready</strong>
        </div>

        <div className={styles["phone-cta-pill"]}>Download 4K MP4</div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const tickerLoop = [...HERO_TICKER_TILES, ...HERO_TICKER_TILES, ...HERO_TICKER_TILES];
  const trustLoop = [...TRUSTED_STRIP_ITEMS, ...TRUSTED_STRIP_ITEMS, ...TRUSTED_STRIP_ITEMS];

  return (
    <div className={styles["page"]}>
      {/* ── Floating Glass Pill Navigation ── */}
      <nav className={styles["floating-nav"]} aria-label="Primary">
        <div className={styles["nav-group"]}>
          <a href={NAV_LEFT[0].href} className={styles["nav-link"]}>
            {NAV_LEFT[0].label}
          </a>
          <span className={styles["nav-dot"]} aria-hidden="true" />
          <a href={NAV_LEFT[1].href} className={styles["nav-link"]}>
            {NAV_LEFT[1].label}
          </a>
        </div>

        <a href="#hero" className={styles["nav-logo"]} aria-label="Photo to Video Home">
          <BrandMark />
        </a>

        <div className={styles["nav-group"]}>
          <a href={NAV_RIGHT[0].href} className={styles["nav-link"]}>
            {NAV_RIGHT[0].label}
          </a>
          <span className={styles["nav-dot"]} aria-hidden="true" />
          <a href={NAV_RIGHT[1].href} className={styles["nav-link"]}>
            {NAV_RIGHT[1].label}
          </a>
        </div>
      </nav>

      <main className={styles["main"]}>
        {/* ── 1. Hero ── */}
        <section className={styles["hero"]} id="hero">
          <div className={styles["hero-light"]} aria-hidden="true">
            <div className={styles["hero-light-outer"]} />
            <div className={styles["hero-light-core"]} />
          </div>
          <StarfieldCanvas className={styles["hero-particles"]} />

          <div className={styles["hero-content"]}>
            <div className={styles["hero-headline-wrap"]}>
              <h1 className={styles["hero-title"]}>Turn Photos Into</h1>
              <p className={styles["hero-title-italic"]}>Cinematic Videos</p>
            </div>
            <p className={styles["hero-subtitle"]}>
              Upload room photos. Our AI restyles, animates, and assembles a polished video in minutes.
            </p>
            <Link href="/signup" className={styles["blue-btn"]}>
              <span>Get Started Free</span>
              <Icon icon={AiVideoIcon} size={17} strokeWidth={1.75} />
            </Link>
          </div>

          <div className={styles["hero-stage"]}>
            <div className={styles["hero-hand-wrap"]}>
              <img
                src="/hero-phone-hand.png"
                alt="Photo to Video mobile studio preview"
                className={styles["hero-hand-img"]}
              />
            </div>
            <div className={styles["hero-ticker-mask"]} aria-hidden="true">
              <div className={styles["hero-ticker-track"]}>
                {tickerLoop.map((tile, idx) => (
                  <div key={`${tile.label}-${idx}`} className={styles["hero-ticker-item"]}>
                    <img src={tile.src} alt="" />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles["hero-bottom-fade"]} aria-hidden="true" />
          </div>
        </section>

        {/* ── 2. Trusted / Metrics Marquee Strip ── */}
        <section className={styles["companies-section"]} id="companies" aria-label="Platform highlights">
          <div className={styles["companies-mask"]}>
            <div className={styles["companies-track"]}>
              {trustLoop.map((item, idx) => (
                <div key={`${item.label}-${idx}`} className={styles["company-slot"]}>
                  <span className={styles["company-mark"]} aria-hidden="true">
                    <Icon
                      icon={TRUST_STRIP_ICONS[idx % TRUST_STRIP_ICONS.length]}
                      size={18}
                      strokeWidth={1.6}
                    />
                  </span>
                  <span className={styles["company-name"]}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. Features Carousel ── */}
        <FeaturesCarousel />

        {/* ── 4. Gallery 3-Column Vertical Marquee ── */}
        <GallerySection />

        {/* ── 5. How It Works (3 Alternating Rows) ── */}
        <section className={styles["how-section"]} id="how-it-works">
          <div className={styles["section-header"]}>
            <span className={styles["section-pill"]}>How It Works</span>
            <h2 className={styles["how-section-title"]}>
              AI-Powered
              <br />
              Video Creation
            </h2>
          </div>

          <div className={styles["how-rows"]}>
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.id}
                className={`${styles["how-row"]} ${
                  step.align === "right" ? styles["how-row-reverse"] : ""
                }`}
              >
                <div className={styles["how-device-col"]}>
                  <PhoneMockup step={step} />
                </div>
                <div className={styles["how-copy-col"]}>
                  <h3 className={styles["how-step-title"]}>{step.title}</h3>
                  <p className={styles["how-step-body"]}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. Orbiting Glass Icons Ring + Horizon Glow ── */}
        <section className={styles["icons-section"]} id="icons">
          <h2 className={styles["icons-title"]}>
            Boost Your Listings With
            <br />
            Cinematic Video
          </h2>

          <div className={styles["orbit-stage"]} aria-hidden="true">
            <div className={styles["orbit-glow"]} />
            <div className={styles["orbit-ring"]}>
              {ORBIT_ICONS.map(({ id, icon, angle }) => (
                <div
                  key={id}
                  className={styles["orbit-spoke"]}
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div
                    className={styles["orbit-orb"]}
                    style={{ transform: `rotate(-${angle}deg)` }}
                  >
                    <div className={styles["orbit-orb-inner"]}>
                      <Icon icon={icon} size={40} strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. Pricing (Overlapping Frosted Glass Sheet) ── */}
        <PricingSection />

        {/* ── 8. Bottom CTA Card ── */}
        <section className={styles["cta-section"]} id="cta">
          <div className={styles["cta-card"]}>
            <div className={styles["cta-copy"]}>
              <span className={styles["section-pill"]}>Get Started</span>
              <div className={styles["cta-text-stack"]}>
                <h2 className={styles["cta-title"]}>
                  AI-Powered
                  <br />
                  Video Creation
                </h2>
                <p className={styles["cta-body"]}>
                  Watch as our AI transforms your room photos into a one-of-a-kind cinematic video, crafted with precision and style. No credit card required.
                </p>
              </div>
              <Link href="/signup" className={styles["blue-btn"]}>
                <span>Generate Free Video</span>
                <Icon icon={AiVideoIcon} size={17} strokeWidth={1.75} />
              </Link>
            </div>

            <div className={styles["cta-visual"]}>
              <div className={styles["cta-orb"]} aria-hidden="true" />
              <PhoneMockup step="cta" />
            </div>
          </div>
        </section>
      </main>

      {/* ── 9. Footer ── */}
      <footer className={styles["footer"]}>
        <div className={styles["footer-top"]}>
          <div className={styles["footer-columns"]}>
            <div className={styles["footer-col"]}>
              <h4 className={styles["footer-col-title"]}>Quick Links</h4>
              <div className={styles["footer-links"]}>
                <a href="#hero" className={styles["footer-link"]}>Home</a>
                <a href="#features" className={styles["footer-link"]}>Features</a>
                <a href="#gallery" className={styles["footer-link"]}>Gallery</a>
                <a href="#pricing" className={styles["footer-link"]}>Pricing</a>
              </div>
            </div>

            <div className={styles["footer-col"]}>
              <h4 className={styles["footer-col-title"]}>Account</h4>
              <div className={styles["footer-links"]}>
                <Link href="/signup" className={styles["footer-link"]}>Get Started Free</Link>
                <Link href="/login" className={styles["footer-link"]}>Sign In</Link>
                <a href="#how-it-works" className={styles["footer-link"]}>How It Works</a>
              </div>
            </div>

            <div className={styles["footer-col"]}>
              <h4 className={styles["footer-col-title"]}>Legal</h4>
              <div className={styles["footer-links"]}>
                <a href="#pricing" className={styles["footer-link"]}>Privacy Policy</a>
                <a href="#pricing" className={styles["footer-link"]}>Terms Of Service</a>
              </div>
            </div>
          </div>

          <div className={styles["footer-socials"]}>
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className={styles["social-pill"]}
              aria-label="X"
            >
              <Icon icon={NewTwitterIcon} size={22} strokeWidth={1.6} />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className={styles["social-pill"]}
              aria-label="Instagram"
            >
              <Icon icon={InstagramIcon} size={22} strokeWidth={1.6} />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className={styles["social-pill"]}
              aria-label="YouTube"
            >
              <Icon icon={YoutubeIcon} size={24} strokeWidth={1.6} />
            </a>
          </div>
        </div>

        <div className={styles["footer-wordmark-wrap"]} aria-hidden="true">
          <span className={styles["footer-wordmark"]}>Photo2Video</span>
        </div>

        <p className={styles["footer-copy"]}>&copy; 2026 Photo-to-Video AI</p>
      </footer>
    </div>
  );
}
