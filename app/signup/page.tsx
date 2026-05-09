"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabaseRef.current.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSuccess("Check your email for a confirmation link.");
    setLoading(false);
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
          Create Your Account to<br />Unleash Your Dreams
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
            Already have an account?
            <Link href="/login">Log in</Link>
          </span>
        </div>

        {error && <div className="auth-message error">{error}</div>}
        {success && <div className="auth-message success">{success}</div>}

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
          <div className="auth-field">
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-split-submit" disabled={loading}>
            <span>{loading ? "Creating account…" : "Start Creating"}</span>
            <span className="auth-split-submit-arrow">→</span>
          </button>
        </form>

        <p className="auth-legal">
          By signing in, you agree to Photo → Video&apos;s{" "}
          <a href="#">Terms of Service</a>,{" "}
          <a href="#">Privacy Policy</a> and{" "}
          <a href="#">Data Usage Properties</a>.
        </p>
      </div>
    </div>
  );
}
