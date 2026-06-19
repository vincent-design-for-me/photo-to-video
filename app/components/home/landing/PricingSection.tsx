"use client";

import { useState } from "react";
import Link from "next/link";
import { PRICING_PLANS } from "./landingData";

export function PricingSection() {
  const [pricingAnnual, setPricingAnnual] = useState(false);

  return (
    <section className="lp-section" id="pricing">
      <div className="lp-container">
        <span className="lp-label">Pricing</span>
        <h2 className="lp-display-lg">Plans for everyone</h2>
        <p className="lp-section-sub">Start free. Upgrade as you grow.</p>
        <div className="lp-pricing-toggle">
          <button
            className={`lp-toggle-btn${!pricingAnnual ? " lp-toggle-btn--active" : ""}`}
            onClick={() => setPricingAnnual(false)}
          >Monthly</button>
          <button
            className={`lp-toggle-btn${pricingAnnual ? " lp-toggle-btn--active" : ""}`}
            onClick={() => setPricingAnnual(true)}
          >Annual <span className="lp-toggle-save">Save 20%</span></button>
        </div>
        <div className="lp-pricing-grid">
          {PRICING_PLANS.map(plan => (
            <div key={plan.name} className={`lp-pricing-card${plan.featured ? " lp-pricing-card--featured" : ""}`}>
              {plan.featured && <span className="lp-pricing-badge">Most popular</span>}
              <h3 className="lp-pricing-name">{plan.name}</h3>
              <div className="lp-pricing-price">
                <span className="lp-pricing-amount">{pricingAnnual ? plan.annualPrice : plan.monthlyPrice}</span>
                <span className="lp-pricing-per">/mo</span>
              </div>
              {pricingAnnual && plan.annualPrice !== plan.monthlyPrice && (
                <p className="lp-pricing-note-annual">billed annually</p>
              )}
              <p className="lp-pricing-videos">{plan.videos}</p>
              <ul className="lp-pricing-features">
                {plan.features.map(f => (
                  <li key={f} className="lp-pricing-feature">
                    <span className="lp-pricing-check">&#10003;</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={plan.featured ? "lp-btn-ink lp-btn-block" : "lp-btn-outline lp-btn-block"}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="lp-pricing-footer-note">All plans include a 7-day free trial. No credit card required.</p>
      </div>
    </section>
  );
}
