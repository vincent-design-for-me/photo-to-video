"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const urlError = params.get("error");
    setToken(urlToken);
    if (urlError) {
      setError("This reset link is invalid or has expired. Please request a new one.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing password reset token. Please use the link from your email.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (error) {
      setError(error.message ?? "Could not update password");
      setLoading(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="blob-1" />
      <div className="blob-2" />
      <div className="blob-3" />

      <div className="auth-card">
        <p className="auth-logo">Photo → Video</p>
        <h1 className="auth-title">New password</h1>
        <p className="auth-subtitle">Choose a new password for your account</p>

        {error && <div className="auth-message error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
