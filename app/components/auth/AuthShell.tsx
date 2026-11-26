"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AiBeautifyIcon } from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import styles from "./AuthShell.module.css";

type AuthShellProps = {
  mode: "login" | "signup";
  titleLine1: string;
  titleLine2Italic: string;
  subtitle: string;
  visualImage: string;
  visualBadge: string;
  visualTitle: string;
  visualItalic: string;
  visualCaption: string;
  children: ReactNode;
};

function BrandMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5C12.8 7.5 16.5 11.2 21.5 12C16.5 12.8 12.8 16.5 12 21.5C11.2 16.5 7.5 12.8 2.5 12C7.5 11.2 11.2 7.5 12 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AuthShell({
  titleLine1,
  titleLine2Italic,
  subtitle,
  visualImage,
  visualBadge,
  visualTitle,
  visualItalic,
  visualCaption,
  children,
}: AuthShellProps) {
  return (
    <div className={styles["page"]}>
      <main className={styles["main"]}>
        <div className={styles["frame-shell"]}>
          {/* Left full-height editorial showcase panel */}
          <aside className={styles["visual-card"]}>
            <img src={visualImage} alt="Restyled interior showcase" className={styles["visual-img"]} />
            <div className={styles["visual-scrim"]} aria-hidden="true" />

            <div className={styles["visual-top"]}>
              <Link href="/" className={styles["brand-pill"]}>
                <span className={styles["brand-pill-mark"]} aria-hidden="true">
                  <BrandMark />
                </span>
                <span>Photo to Video</span>
              </Link>

              <span className={styles["visual-badge"]}>
                <Icon icon={AiBeautifyIcon} size={14} strokeWidth={1.75} />
                <span>{visualBadge}</span>
              </span>
            </div>

            <div className={styles["visual-bottom"]}>
              <p className={styles["visual-heading"]}>
                {visualTitle}
                <br />
                <span className={styles["visual-heading-italic"]}>{visualItalic}</span>
              </p>
              <p className={styles["visual-caption"]}>{visualCaption}</p>

              <div className={styles["visual-meta-strip"]}>
                <div className={styles["visual-thumbs"]} aria-hidden="true">
                  <img src="/gallery/Luxury Modern.png" alt="" />
                  <img src="/gallery/Japandi.png" alt="" />
                  <img src="/gallery/SCANDINAVIAN.png" alt="" />
                </div>
                <span className={styles["visual-meta-text"]}>
                  4K exports &middot; 10+ styles &middot; &lt;2 min
                </span>
              </div>
            </div>
          </aside>

          {/* Right full-height pure-white form panel */}
          <section className={styles["form-card"]}>
            <div className={styles["form-orb"]} aria-hidden="true" />

            <div className={styles["form-inner"]}>
              <div className={styles["form-head"]}>
                <h1 className={styles["title"]}>
                  {titleLine1}
                  <br />
                  <span className={styles["title-italic"]}>{titleLine2Italic}</span>
                </h1>
                <p className={styles["subtitle"]}>{subtitle}</p>
              </div>

              {children}

              <p className={styles["legal"]}>
                By continuing, you agree to Photo to Video&apos;s{" "}
                <Link href="/#pricing" className={styles["legal-link"]}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/#pricing" className={styles["legal-link"]}>
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
