"use client";

import { FormEvent, useState } from "react";

export function ContactForm({ topic }: { topic: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setPending(true);
    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, topic }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many messages. Please try again in a minute."
            : result.message ||
                "We could not send your message. Please try again.",
        );
      form.reset();
      setMessage("Thank you. We will reply by email.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Please try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="c-name">Name</label>
        <input
          id="c-name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
        />
      </div>
      <div className="field">
        <label htmlFor="c-email">Email</label>
        <input
          id="c-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea
          id="c-message"
          name="message"
          rows={4}
          required
          minLength={5}
          maxLength={2000}
        />
      </div>
      <p className="err-t" role="alert">
        {error}
      </p>
      {message && (
        <p className="ok-t" role="status">
          {message}
        </p>
      )}
      <button className="btn btn-d" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
