"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Mode =
  | "sign-up"
  | "sign-in"
  | "forgot-password"
  | "reset-password"
  | "verify"
  | "resend-verification";
const endpoints: Record<Mode, string> = {
  "sign-up": "register",
  "sign-in": "login",
  "forgot-password": "forgot-password",
  "reset-password": "reset-password",
  verify: "verify-email",
  "resend-verification": "resend-verification",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const token =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    try {
      const body =
        mode === "verify"
          ? { token }
          : mode === "reset-password"
            ? { token, password: data.password }
            : mode === "sign-up"
              ? {
                  fullName: data.fullName,
                  email: data.email,
                  password: data.password,
                  confirmPassword: data.confirmPassword,
                  ageConfirmed: data.ageConfirmed === "on",
                  termsAccepted: data.termsAccepted === "on",
                }
              : data;
      const response = await fetch(`/api/v1/auth/${endpoints[mode]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? "Email delivery is unavailable. If you already registered, request a new verification link when service returns."
            : result.message || "Request failed",
        );
      if (mode === "sign-in") {
        const destination = search.get("next");
        router.replace(
          destination?.startsWith("/dashboard") ? destination : "/dashboard",
        );
        router.refresh();
      } else {
        setMessage(result.message ?? "Done");
        if (mode === "verify" || mode === "reset-password")
          window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "sign-up" && (
        <label>
          Full name
          <input
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
          />
        </label>
      )}
      {[
        "sign-up",
        "sign-in",
        "forgot-password",
        "resend-verification",
      ].includes(mode) && (
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
      )}
      {["sign-up", "sign-in", "reset-password"].includes(mode) && (
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "sign-in" ? 1 : 12}
          />
        </label>
      )}
      {mode === "sign-up" && (
        <>
          <label>
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <label className="check-line">
            <input name="ageConfirmed" type="checkbox" required />I confirm I am
            at least 18.
          </label>
          <label className="check-line">
            <input name="termsAccepted" type="checkbox" required />I accept the{" "}
            <Link href="/terms">terms</Link> and{" "}
            <Link href="/privacy">privacy notice</Link>.
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <button className="orange-button" type="submit" disabled={pending}>
        {pending
          ? "Please wait…"
          : mode === "sign-up"
            ? "Create account"
            : mode === "sign-in"
              ? "Sign in"
              : mode === "forgot-password"
                ? "Send reset link"
                : mode === "verify"
                  ? "Verify email"
                  : mode === "resend-verification"
                    ? "Resend verification link"
                    : "Reset password"}
      </button>
      <div className="auth-links">
        <Link href="/sign-in">Sign in</Link>
        <Link href="/sign-up">Create account</Link>
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/resend-verification">Resend verification</Link>
      </div>
    </form>
  );
}
