"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message ?? "Could not send password reset email");
      setLoading(false);
      return;
    }

    setSuccess("If an account exists for that email, a password reset link has been sent.");
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="blob-1" />
      <div className="blob-2" />
      <div className="blob-3" />

      <div className="auth-card">
        <p className="auth-logo">Photo → Video</p>
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">
          Enter your email and we&apos;ll send a reset link
        </p>

        {error && <div className="auth-message error">{error}</div>}
        {success && <div className="auth-message success">{success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password?{" "}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
