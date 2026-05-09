"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { canonicalizeAuthPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const [callbackError, setCallbackError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(canonicalizeAuthPath(params.get("next") ?? "/"));
    setCallbackError(params.get("error") ?? "");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="auth-split">
      <div className="auth-split-image">
        <img src="/auth-hero.jpg" alt="Scenic landscape" />
        <a href="/" className="auth-split-logo">Photo → Video</a>
        <p className="auth-image-caption">Photo by Tilak Baloni · Unsplash</p>
      </div>

      <div className="auth-split-form">
        <h1 className="auth-split-title">
          Welcome Back,<br />Let&apos;s Keep Creating
        </h1>

        <div className="auth-split-nav">
          <button
            className="auth-back-btn"
            onClick={() => router.back()}
            type="button"
            aria-label="Go back"
          >
            ←
          </button>
          <span className="auth-nav-text">
            Don&apos;t have an account?
            <Link href="/signup">Sign up</Link>
          </span>
        </div>

        {(error || callbackError) && (
          <div className="auth-message error">{error || callbackError}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-split-submit" disabled={loading}>
            <span>{loading ? "Signing in…" : "Sign In"}</span>
            <span className="auth-split-submit-arrow">→</span>
          </button>
        </form>

        <p className="auth-legal">
          By signing in, you agree to our{" "}
          <a href="#">Terms of Service</a>,{" "}
          <a href="#">Privacy Policy</a> and{" "}
          <a href="#">Data Usage Properties</a>.
        </p>
      </div>
    </div>
  );
}
