import Link from "next/link";
import { GallerySlider } from "./GallerySlider";
import { PricingSection } from "./PricingSection";
import { ComparisonSection } from "./ComparisonSection";
import {
  CHECKLIST_EVERY_PLAN,
  CHECKLIST_EVERY_VIDEO,
  FAQ_ITEMS,
  GALLERY_TILES,
  TESTIMONIALS,
  WHY_STATS,
} from "./landingData";

const CONTROL_FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
      </svg>
    ),
    title: "Aspect ratio",
    body: "Choose 16:9 for listings, 1:1 for social feeds, or 3:4 for vertical reels.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 6.36 15.36" />
        <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
      </svg>
    ),
    title: "Interior style",
    body: "Modern, Scandinavian, Industrial, Luxury — 10+ styles to match any property.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: "Resolution",
    body: "Export in 720p for quick previews or 4K for premium listing presentations.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    title: "Background music",
    body: "AI picks a licensed soundtrack that matches the mood and style of your video.",
  },
];

export function LandingPage() {
  return (
    <div className="landing-page">

      {/* ── Hero ── */}
      <div className="landing-hero">
        <img className="landing-hero-bg" src="/hero-bg.jpg" alt="" aria-hidden="true" />
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Turn Your Photos Into<br />Cinematic Videos
          </h1>
          <p className="landing-hero-subtitle">
            Upload room photos. Our AI restyles, animates, and assembles a polished video — perfect for listings, short-form ads, and portfolio pieces.
          </p>
          <Link href="/signup" className="landing-hero-cta">Get Started Free</Link>
        </div>
      </div>

      {/* ── Why You Need Videos & Better Photos ── */}
      <section className="lp-why-section">
        <div className="lp-why-orb lp-why-orb--mint" aria-hidden="true" />
        <div className="lp-why-orb lp-why-orb--peach" aria-hidden="true" />
        <div className="lp-why-container">
          <div className="lp-why-header">
            <span className="lp-why-label">Industry Data</span>
            <h2 className="lp-why-title">Why You Need Video &amp; Better Photos</h2>
            <p className="lp-why-sub">
              In a crowded market, static photos have become the bare minimum.
              Only dynamic visuals hold attention — and the numbers prove it.
            </p>
          </div>
          <div className="lp-why-stats">
            {WHY_STATS.map(stat => (
              <div key={stat.metric} className="lp-why-stat">
                <span className="lp-why-num">{stat.num}</span>
                <span className="lp-why-metric">{stat.metric}</span>
                <p className="lp-why-desc">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sections below hero ── */}
      <div className="lp-sections">

        {/* 1. How It Works */}
        <section className="lp-section" id="how-it-works">
          <div className="lp-container">
            <span className="lp-label">Simple process</span>
            <h2 className="lp-display-lg">Three steps to cinematic</h2>
            <div className="lp-steps-grid">

              {/* Step 1 — Upload */}
              <div className="lp-step-card">
                <div className="lp-step-mockup">
                  <div className="lp-mock lp-mock--upload">
                    <div className="lp-mock-thumbs">
                      <div className="lp-mock-thumb lp-mock-thumb--peach" />
                      <div className="lp-mock-thumb lp-mock-thumb--sky" />
                      <div className="lp-mock-thumb lp-mock-thumb--lavender" />
                      <div className="lp-mock-thumb lp-mock-thumb--add">+</div>
                    </div>
                    <div className="lp-mock-upload-bar">
                      <span className="lp-mock-cta-pill">Browse Files</span>
                      <span className="lp-mock-format-hint">JPEG &middot; PNG &middot; WebP</span>
                    </div>
                  </div>
                </div>
                <div className="lp-step-content">
                  <span className="lp-step-num">01</span>
                  <h3 className="lp-step-title">Upload photos</h3>
                  <p className="lp-step-body">Drag and drop your room photos. JPEG, PNG, or WebP accepted — no limit.</p>
                </div>
              </div>

              {/* Step 2 — AI Generates */}
              <div className="lp-step-card">
                <div className="lp-step-mockup">
                  <div className="lp-mock lp-mock--generate">
                    <div className="lp-mock-control-row">
                      <span className="lp-mock-ctrl-label">Style</span>
                      <div className="lp-mock-selectors">
                        <span className="lp-mock-sel lp-mock-sel--active">Modern</span>
                        <span className="lp-mock-sel">Luxury</span>
                        <span className="lp-mock-sel">Japandi</span>
                      </div>
                    </div>
                    <div className="lp-mock-control-row">
                      <span className="lp-mock-ctrl-label">Ratio</span>
                      <div className="lp-mock-selectors">
                        <span className="lp-mock-sel">16:9</span>
                        <span className="lp-mock-sel lp-mock-sel--active">3:4</span>
                        <span className="lp-mock-sel">1:1</span>
                      </div>
                    </div>
                    <div className="lp-mock-progress-wrap">
                      <div className="lp-mock-progress-track">
                        <div className="lp-mock-progress-fill" style={{ width: "65%" }} />
                      </div>
                      <span className="lp-mock-progress-label">Generating video&hellip;</span>
                    </div>
                  </div>
                </div>
                <div className="lp-step-content">
                  <span className="lp-step-num">02</span>
                  <h3 className="lp-step-title">AI generates</h3>
                  <p className="lp-step-body">Our AI restyles each shot and animates them into a polished cinematic sequence.</p>
                </div>
              </div>

              {/* Step 3 — Download */}
              <div className="lp-step-card">
                <div className="lp-step-mockup">
                  <div className="lp-mock lp-mock--download">
                    <div className="lp-mock-player">
                      <div className="lp-mock-play-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                          <polygon points="6,4 20,12 6,20" />
                        </svg>
                      </div>
                      <span className="lp-mock-duration">0:47</span>
                    </div>
                    <div className="lp-mock-dl-row">
                      <div className="lp-mock-cta-pill lp-mock-cta-pill--dl">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                          <path d="M12 5v10M7 15l5 5 5-5" /><path d="M5 20h14" />
                        </svg>
                        Download 1080p
                      </div>
                      <span className="lp-mock-format-hint">MP4</span>
                    </div>
                  </div>
                </div>
                <div className="lp-step-content">
                  <span className="lp-step-num">03</span>
                  <h3 className="lp-step-title">Download &amp; share</h3>
                  <p className="lp-step-body">Export in 720p, 1080p, or 4K — ready for listings, reels, or portfolios.</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 2. Feature Checklist */}
        <section className="lp-section lp-section--soft">
          <div className="lp-container">
            <div className="lp-checklist-grid">
              <div className="lp-checklist-block">
                <h3 className="lp-checklist-title">Every video includes</h3>
                <ul className="lp-checklist">
                  {CHECKLIST_EVERY_VIDEO.map(f => (
                    <li key={f} className="lp-checklist-item"><span className="lp-check">&#10003;</span>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="lp-checklist-divider" />
              <div className="lp-checklist-block">
                <h3 className="lp-checklist-title">Every plan includes</h3>
                <ul className="lp-checklist">
                  {CHECKLIST_EVERY_PLAN.map(f => (
                    <li key={f} className="lp-checklist-item"><span className="lp-check">&#10003;</span>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Stats + Gallery */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-stats-bar">
              <strong className="lp-stat-number">1,240+</strong>&nbsp;videos generated by&nbsp;
              <strong className="lp-stat-number">890+</strong>&nbsp;happy users
              <span className="lp-stars" aria-label="4.9 out of 5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              <span className="lp-stat-score">4.9 / 5</span>
            </div>
            <div className="lp-gallery-grid">
              {GALLERY_TILES.map(tile => (
                <div key={tile.label} className="lp-gallery-tile">
                  {tile.before && tile.img
                    ? <GallerySlider beforeSrc={tile.before} afterSrc={tile.img} label={tile.label} />
                    : tile.img && <img src={tile.img} alt={tile.label} className="lp-gallery-tile-img" />
                  }
                  {!tile.before && <span className="lp-gallery-label">{tile.label}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Testimonials */}
        <section className="lp-section lp-section--soft">
          <div className="lp-container">
            <span className="lp-label">Testimonials</span>
            <h2 className="lp-display-lg">Loved by agents and creators</h2>
            <div className="lp-testimonials-grid">
              {TESTIMONIALS.map(t => (
                <div key={t.name} className="lp-testimonial-card">
                  <div className="lp-testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <p className="lp-testimonial-quote">{t.quote}</p>
                  <div className="lp-testimonial-author">
                    <div className="lp-testimonial-avatar">{t.init}</div>
                    <div>
                      <strong className="lp-testimonial-name">{t.name}</strong>
                      <span className="lp-testimonial-role">{t.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Features / Controls showcase */}
        <section className="lp-section">
          <div className="lp-container">
            <span className="lp-label">Controls</span>
            <h2 className="lp-display-lg">Every control you need<br />to get it perfect</h2>
            <div className="lp-features-grid">
              {CONTROL_FEATURES.map(f => (
                <div key={f.title} className="lp-feature-card">
                  <span className="lp-feature-icon">{f.icon}</span>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-body">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Why Our AI / Comparison */}
        <ComparisonSection />

        {/* 7. Mid-page CTA band */}
        <section className="lp-cta-band">
          <div className="lp-container lp-cta-band-inner">
            <h2 className="lp-display-lg lp-cta-band-title">Ready to transform your photos?</h2>
            <p className="lp-cta-sub">No credit card required. Cancel anytime.</p>
            <Link href="/signup" className="lp-btn-ink">Generate Your First Video Free &rarr;</Link>
          </div>
        </section>

        {/* 8. Pricing */}
        <PricingSection />

        {/* 9. FAQ */}
        <section className="lp-section lp-section--soft" id="faq">
          <div className="lp-container lp-faq-container">
            <span className="lp-label">FAQ</span>
            <h2 className="lp-display-lg">Frequently asked questions</h2>
            <div className="lp-faq-list">
              {FAQ_ITEMS.map(item => (
                <details key={item.q} className="lp-faq-item">
                  <summary className="lp-faq-question">{item.q}</summary>
                  <p className="lp-faq-answer">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 10. Final CTA */}
        <section className="lp-final-cta">
          <div className="lp-orb lp-orb--mint" aria-hidden="true" />
          <div className="lp-orb lp-orb--peach" aria-hidden="true" />
          <div className="lp-container lp-final-cta-inner">
            <h2 className="lp-final-cta-title">Transform your photos<br />into cinematic videos</h2>
            <p className="lp-final-cta-sub">Get started in seconds. No credit card required.</p>
            <Link href="/signup" className="lp-btn-ink lp-btn-ink--lg">Start Free &rarr;</Link>
            <div className="lp-final-stars">
              <span className="lp-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              <span>Loved by 890+ users</span>
            </div>
          </div>
        </section>

        {/* 11. Footer */}
        <footer className="lp-footer">
          <div className="lp-container">
            <div className="lp-footer-grid">
              <div className="lp-footer-brand">
                <span className="lp-footer-logo">Photo-to-Video</span>
                <p className="lp-footer-tagline">Transform room photos into cinematic AI-generated videos in minutes.</p>
              </div>
              <div className="lp-footer-col">
                <h4 className="lp-footer-col-title">Product</h4>
                <Link href="/signup" className="lp-footer-link">Get Started</Link>
                <a href="#pricing" className="lp-footer-link">Pricing</a>
                <a href="#how-it-works" className="lp-footer-link">How It Works</a>
                <a href="#faq" className="lp-footer-link">FAQ</a>
              </div>
              <div className="lp-footer-col">
                <h4 className="lp-footer-col-title">Company</h4>
                <a href="#" className="lp-footer-link">About</a>
                <a href="#" className="lp-footer-link">Blog</a>
              </div>
              <div className="lp-footer-col">
                <h4 className="lp-footer-col-title">Legal</h4>
                <a href="#" className="lp-footer-link">Privacy Policy</a>
                <a href="#" className="lp-footer-link">Terms of Service</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <div className="lp-container">
              <span>&copy; 2026 Photo-to-Video. All rights reserved.</span>
            </div>
          </div>
        </footer>

      </div>{/* .lp-sections */}
    </div>
  );
}
