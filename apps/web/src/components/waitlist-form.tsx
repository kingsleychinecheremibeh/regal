"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type Status = "idle" | "loading" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Please agree to receive launch updates.");
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      if (!response.ok) {
        if (response.status === 429)
          throw new Error("Too many attempts. Please try again in a minute.");
        if (response.status === 400)
          throw new Error("Please enter a valid email and agree to updates.");
        throw new Error("We could not save your request. Please try again.");
      }
      setStatus("success");
      setEmail("");
    } catch (cause) {
      setStatus("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  if (status === "success")
    return (
      <div className="notice ok" role="status">
        Thanks for your interest. You are on the launch list.
      </div>
    );

  return (
    <form onSubmit={submit} className="waitlist">
      <div className="row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          className="grow"
          style={{ minWidth: 220, width: "auto" }}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email address"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "loading"}
        />
        <button
          className="btn btn-p btn-lg"
          type="submit"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Joining…" : "Join the launch list"}
        </button>
      </div>
      <label className="check mt">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={status === "loading"}
        />
        <span className="mut">
          I agree to receive TurboXGlobal launch updates by email. See the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </span>
      </label>
      <p className="err-t" role="alert">
        {error}
      </p>
    </form>
  );
}
