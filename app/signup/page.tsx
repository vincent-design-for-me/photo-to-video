"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight02Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/app/components/auth/AuthShell";
import styles from "@/app/components/auth/AuthShell.module.css";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const derivedName = email.split("@")[0]?.trim() || "Creator";
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: derivedName,
    });
    if (error) {
      setError(error.message ?? "Could not create account");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell
      mode="signup"
      titleLine1="Create your"
      titleLine2Italic="studio account"
      subtitle="Start free with 3 videos per month. No credit card required."
      visualImage="/gallery/Japandi.png"
      visualBadge="Start Free · 3 Videos / Month"
      visualTitle="Turn Photos Into"
      visualItalic="Cinematic Videos"
      visualCaption="Upload room photos, pick an interior aesthetic, and export listing-ready video in under 2 minutes."
    >
      {error && (
        <div className={styles["alert-error"]} role="alert">
          {error}
        </div>
      )}

      <form className={styles["form"]} onSubmit={handleSubmit}>
        <div className={styles["field"]}>
          <label htmlFor="signup-email" className={styles["label"]}>
            Email address
          </label>
          <input
            id="signup-email"
            type="email"
            className={styles["input"]}
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </div>

        <div className={styles["field"]}>
          <label htmlFor="signup-password" className={styles["label"]}>
            Password
          </label>
          <div className={styles["password-wrap"]}>
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              className={`${styles["input"]} ${styles["password-input"]}`}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            <button
              type="button"
              className={styles["toggle-btn"]}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <Icon icon={ViewIcon} altIcon={ViewOffSlashIcon} showAlt={showPassword} size={17} />
            </button>
          </div>
        </div>

        <div className={styles["field"]}>
          <label htmlFor="signup-confirm" className={styles["label"]}>
            Confirm password
          </label>
          <div className={styles["password-wrap"]}>
            <input
              id="signup-confirm"
              type={showConfirm ? "text" : "password"}
              className={`${styles["input"]} ${styles["password-input"]}`}
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            <button
              type="button"
              className={styles["toggle-btn"]}
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirm}
            >
              <Icon icon={ViewIcon} altIcon={ViewOffSlashIcon} showAlt={showConfirm} size={17} />
            </button>
          </div>
        </div>

        <button type="submit" className={styles["submit-btn"]} disabled={loading}>
          <span>{loading ? "Creating account…" : "Start Creating"}</span>
          <span className={styles["submit-arrow"]} aria-hidden="true">
            <Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.75} />
          </span>
        </button>
      </form>

      <div className={styles["switch-row"]}>
        <span>Already have an account?</span>
        <Link href="/login" className={styles["switch-link"]}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
