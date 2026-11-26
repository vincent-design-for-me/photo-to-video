"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight02Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { authClient } from "@/lib/auth/client";
import { canonicalizeAuthPath } from "@/lib/auth/paths";
import { AuthShell } from "@/app/components/auth/AuthShell";
import styles from "@/app/components/auth/AuthShell.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const [callbackError, setCallbackError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(canonicalizeAuthPath(params.get("next") ?? "/"));
    setCallbackError(params.get("error") ?? "");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Invalid email or password");
      setLoading(false);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <AuthShell
      mode="login"
      titleLine1="Welcome back,"
      titleLine2Italic="keep creating"
      subtitle="Sign in to access your video library, saved room presets, and active renders."
      visualImage="/gallery/Luxury Modern.png"
      visualBadge="AI Interior Video Studio"
      visualTitle="Pick Up Where"
      visualItalic="You Left Off"
      visualCaption="Your restyled room scenes, camera transitions, and 4K listing exports stay synced in the cloud."
    >
      {(error || callbackError) && (
        <div className={styles["alert-error"]} role="alert">
          {error || callbackError}
        </div>
      )}

      <form className={styles["form"]} onSubmit={handleSubmit}>
        <div className={styles["field"]}>
          <label htmlFor="login-email" className={styles["label"]}>
            Email address
          </label>
          <input
            id="login-email"
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
          <div className={styles["label-row"]}>
            <label htmlFor="login-password" className={styles["label"]}>
              Password
            </label>
            <Link href="/forgot-password" className={styles["forgot-link"]}>
              Forgot password?
            </Link>
          </div>
          <div className={styles["password-wrap"]}>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className={`${styles["input"]} ${styles["password-input"]}`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

        <button type="submit" className={styles["submit-btn"]} disabled={loading}>
          <span>{loading ? "Signing in…" : "Sign In"}</span>
          <span className={styles["submit-arrow"]} aria-hidden="true">
            <Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.75} />
          </span>
        </button>
      </form>

      <div className={styles["switch-row"]}>
        <span>Don&apos;t have an account?</span>
        <Link href="/signup" className={styles["switch-link"]}>
          Sign up free
        </Link>
      </div>
    </AuthShell>
  );
}
