"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

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
      setError("Please agree to receive pre-launch updates.");
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

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-2xl border border-[#6aaea4]/40 bg-[#6aaea4]/10 p-5 text-[#dbf8f1]"
      >
        <CheckCircle2 className="size-6 shrink-0 text-[#8bd3c6]" />
        <span>Thanks for your interest. You are on the waitlist.</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <Input
          id="waitlist-email"
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
        <Button
          type="submit"
          size="large"
          className="shrink-0"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Joining…" : "Join the waitlist"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="waitlist-consent"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          disabled={status === "loading"}
          aria-required="true"
        />
        <label
          htmlFor="waitlist-consent"
          className="text-sm leading-relaxed text-[#a6b7c0]"
        >
          I agree to receive Regalvest pre-launch updates by email. See our{" "}
          <Link
            href="/privacy"
            className="text-[#a9dbd3] underline underline-offset-4 hover:text-white"
          >
            privacy notice
          </Link>
          .
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#ffb9a7]">
          {error}
        </p>
      )}
    </form>
  );
}
