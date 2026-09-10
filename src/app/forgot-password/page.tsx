"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import BackToHome from "@/components/BackToHome";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setSent(true);
    else setError("Something went wrong. Please try again.");
  }

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-layout">
          <aside className="login-visual">
            <Link
              className="login-visual-brand"
              href="/"
              aria-label="Atlas Learning home"
            >
              <Logo />
            </Link>
            <p className="login-visual-caption">
              Your school&apos;s learning space is private and secure.
            </p>
          </aside>
          <div className="login-card" style={{ textAlign: "center" }}>
            <BackToHome href="/login" />
            <h1>Check your email</h1>
            <p className="muted">
              If an account exists for {email}, you&apos;ll receive a password
              reset link shortly.
            </p>
            <Link
              href="/login"
              className="text-button"
              style={{ marginTop: 16, display: "inline-block" }}
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        <aside className="login-visual">
          <Link
            className="login-visual-brand"
            href="/"
            aria-label="Atlas Learning home"
          >
            <Logo />
          </Link>
          <p className="login-visual-caption">
            Your school&apos;s learning space is private and secure.
          </p>
        </aside>
        <div className="login-card">
          <BackToHome href="/login" />
          <h1>Forgot password?</h1>
          <p className="muted">
            Enter your email and we&apos;ll send you a reset link.
          </p>
          <form onSubmit={handleSubmit}>
            {error && (
              <p
                style={{
                  color: "#00000",
                  fontSize: 12,
                  marginBottom: 16,
                  padding: "10px 14px",
                  background: "#b42318",
                  borderRadius: 8,
                }}
              >
                {error}
              </p>
            )}
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.org"
              required
            />
            <button type="submit" className="primary-button login-submit">
              Send reset link
            </button>
          </form>
          <p className="login-help">
            First time here? Check your setup email or{" "}
            <Link href="/contact">contact Atlas Support</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
