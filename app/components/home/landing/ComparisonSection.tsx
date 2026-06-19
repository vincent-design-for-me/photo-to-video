"use client";

import { useState } from "react";
import { COMPARISON_ROWS } from "./landingData";

export function ComparisonSection() {
  const [hoveredCompRow, setHoveredCompRow] = useState<number | null>(null);

  return (
    <section className="lp-section lp-section--soft">
      <div className="lp-container">
        <span className="lp-label">Why Photo-to-Video AI?</span>
        <h2 className="lp-display-lg">A faster way to beautiful video</h2>
        <div className="lp-comp-table" role="table" aria-label="Feature comparison">
          <div className="lp-comp-header" role="row">
            <div className="lp-comp-cell lp-comp-cell--feature" role="columnheader" />
            <div className="lp-comp-cell lp-comp-cell--ours lp-comp-cell--head" role="columnheader">
              <span className="lp-comp-col-label">With our AI</span>
              <span className="lp-comp-col-badge">Best choice</span>
            </div>
            <div className="lp-comp-cell lp-comp-cell--theirs lp-comp-cell--head" role="columnheader">
              Traditional approach
            </div>
          </div>
          {COMPARISON_ROWS.map((row, i) => (
            <div
              key={row.feature}
              className={`lp-comp-row${hoveredCompRow === i ? " lp-comp-row--active" : ""}`}
              role="row"
              onMouseEnter={() => setHoveredCompRow(i)}
              onMouseLeave={() => setHoveredCompRow(null)}
            >
              <div className="lp-comp-cell lp-comp-cell--feature" role="rowheader">{row.feature}</div>
              <div className="lp-comp-cell lp-comp-cell--ours" role="cell">
                <span className="lp-comp-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 7L5.5 10L11.5 4" />
                  </svg>
                </span>
                {row.ours}
              </div>
              <div className="lp-comp-cell lp-comp-cell--theirs" role="cell">
                <span className="lp-comp-x" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M2 2L10 10M10 2L2 10" />
                  </svg>
                </span>
                {row.theirs}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
