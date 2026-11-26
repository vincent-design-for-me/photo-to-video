"use client";

import { useState } from "react";
import Link from "next/link";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { PRICING_PLANS } from "./landingData";
import styles from "./LandingPage.module.css";

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className={styles["pricing-section"]} id="pricing">
      <div className={styles["section-header"]}>
        <span className={styles["section-pill"]}>Pricing</span>
        <h2 className={styles["section-title"]}>Plans That Suit You</h2>

        <div className={styles["billing-toggle"]} role="group" aria-label="Billing interval">
          <button
            type="button"
            className={`${styles["billing-btn"]} ${!annual ? styles["billing-btn-active"] : ""}`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`${styles["billing-btn"]} ${annual ? styles["billing-btn-active"] : ""}`}
            onClick={() => setAnnual(true)}
          >
            <span>Annual</span>
            <span className={styles["billing-save"]}>Save 20%</span>
          </button>
        </div>
      </div>

      <div className={styles["pricing-shell"]}>
        {PRICING_PLANS.map((plan) => {
          const price = annual ? plan.annualPrice : plan.monthlyPrice;
          return (
            <div
              key={plan.name}
              className={`${styles["pricing-row"]} ${
                plan.featured ? styles["pricing-row-featured"] : styles["pricing-row-elevated"]
              }`}
            >
              <div className={styles["pricing-col-left"]}>
                <div className={styles["pricing-plan-head"]}>
                  <div className={styles["pricing-name-line"]}>
                    <h3 className={styles["pricing-plan-name"]}>{plan.name}</h3>
                    {plan.featured && <span className={styles["pricing-popular"]}>Most Popular</span>}
                  </div>
                  <p className={styles["pricing-plan-desc"]}>{plan.description}</p>
                </div>

                <Link
                  href="/signup"
                  className={plan.featured ? styles["featured-cta-full"] : styles["dark-btn-full"]}
                >
                  {plan.cta}
                </Link>
              </div>

              <div className={styles["pricing-col-right"]}>
                <div className={styles["pricing-price-block"]}>
                  <span className={styles["pricing-price"]}>{price}</span>
                  {plan.periodLabel && <span className={styles["pricing-period"]}>{plan.periodLabel}</span>}
                  {annual && plan.annualPrice !== plan.monthlyPrice && (
                    <span className={styles["pricing-billed"]}>billed annually</span>
                  )}
                </div>

                <div className={styles["pricing-features-block"]}>
                  <p className={styles["pricing-features-label"]}>
                    Features &middot; {plan.videos} :
                  </p>
                  <ul className={styles["pricing-features-list"]}>
                    {plan.features.map((feature) => (
                      <li key={feature} className={styles["pricing-feature-item"]}>
                        <span className={styles["pricing-check-icon"]} aria-hidden="true">
                          <Icon icon={Tick02Icon} size={14} strokeWidth={2.2} />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
