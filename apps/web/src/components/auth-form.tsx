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

const notices: Record<string, string> = {
  verified: "Email verified. Sign in to continue.",
  reset: "Password updated. Sign in with your new password.",
};

const links: [Mode, string, string][] = [
  ["sign-in", "/sign-in", "Sign in"],
  ["sign-up", "/sign-up", "Create account"],
  ["forgot-password", "/forgot-password", "Forgot password?"],
  ["resend-verification", "/resend-verification", "Resend verification"],
];

export function AuthForm({
  mode,
  title,
  note,
}: {
  mode: Mode;
  title: string;
  note: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    mode === "sign-in" ? (notices[search.get("notice") ?? ""] ?? "") : "",
  );
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState("");

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
      } else if (mode === "verify" || mode === "reset-password") {
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(
          `/sign-in?notice=${mode === "verify" ? "verified" : "reset"}`,
        );
      } else if (mode === "sign-up") {
        setRegistered(String(data.email));
      } else {
        setMessage(result.message ?? "Done");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again");
    } finally {
      setPending(false);
    }
  }

  if (registered)
    return (
      <div role="status">
        <h2>Check your email</h2>
        <p className="mut">
          We sent a verification link to <b>{registered}</b>. Open it to
          activate your account, then sign in.
        </p>
        <p className="mut">
          Can&apos;t find it? Check your spam folder or request a new link.
        </p>
        <Link className="btn btn-p btn-lg btn-block" href="/sign-in">
          Go to sign in
        </Link>
        <div className="auth-links">
          <Link href="/resend-verification">Resend verification</Link>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit}>
      <h2>{title}</h2>
      <p className="mut">{note}</p>
      {mode === "sign-up" && (
        <label className="field">
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
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
      )}
      {["sign-up", "sign-in", "reset-password"].includes(mode) && (
        <label className="field">
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
          <label className="field">
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <label className="check mb">
            <input name="ageConfirmed" type="checkbox" required />
            <span>I confirm I am at least 18.</span>
          </label>
          <label className="check mb">
            <input name="termsAccepted" type="checkbox" required />
            <span>
              I accept the <Link href="/terms">terms</Link> and{" "}
              <Link href="/privacy">privacy notice</Link>.
            </span>
          </label>
        </>
      )}
      {error && (
        <p className="err-t" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="ok-t" role="status">
          {message}
        </p>
      )}
      <button
        className="btn btn-p btn-lg btn-block"
        type="submit"
        disabled={pending}
      >
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
        {links
          .filter(([m]) => m !== mode)
          .map(([m, href, text]) => (
            <Link key={m} href={href}>
              {text}
            </Link>
          ))}
      </div>
    </form>
  );
}
