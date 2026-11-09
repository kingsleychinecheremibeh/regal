"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type Paged<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** Loads an admin endpoint and reloads whenever the query changes. */
export function useAdmin<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path)
      .then((result) => {
        if (!live) return;
        setData(result);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

/** Builds `path?key=value` from the non-empty entries of `params`. */
export function withQuery(
  path: string,
  params: Record<string, string | number>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== "" && value !== undefined) query.set(key, String(value));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** Runs an admin action, reporting success or failure in one message. */
export function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const run = useCallback(
    async (key: string, path: string, body: unknown = {}) => {
      setBusy(key);
      setNotice(null);
      try {
        const result = await api<{ message?: string }>(path, { body });
        setNotice({ ok: true, text: result.message ?? "Done." });
        onDone?.();
        return true;
      } catch (e) {
        setNotice({ ok: false, text: (e as Error).message });
        return false;
      } finally {
        setBusy("");
      }
    },
    [onDone],
  );
  return { busy, notice, run, clear: () => setNotice(null) };
}

export function Notice({
  notice,
}: {
  notice: { ok: boolean; text: string } | null;
}) {
  if (!notice) return null;
  return (
    <p className={`adm-notice ${notice.ok ? "ok" : "err"}`} role="status">
      {notice.text}
    </p>
  );
}

export function Head({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="mut m0">{sub}</p>}
      </div>
      {action && <div className="row">{action}</div>}
    </div>
  );
}

/** Search box that submits on Enter or the button, plus optional filters. */
export function Toolbar({
  placeholder,
  onSearch,
  children,
}: {
  placeholder: string;
  onSearch: (value: string) => void;
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="adm-toolbar"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim());
      }}
    >
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (!event.target.value) onSearch("");
        }}
      />
      {children}
      <button className="btn btn-p btn-sm" type="submit">
        Search
      </button>
    </form>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="adm-pager">
      <span className="xs mut">
        {from}–{to} of {total.toLocaleString()}
      </span>
      <button
        className="btn btn-s btn-sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="xs">
        Page {page} of {pages}
      </span>
      <button
        className="btn btn-s btn-sm"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

/** Daily bar chart for the last 30 days, filling in days with no data. */
export function Bars({
  points,
  label,
  format = (v) => v.toLocaleString(),
}: {
  points: { day: string; value: number }[];
  label: string;
  format?: (value: number) => string;
}) {
  // Read the clock once per mount; calling it on every render is impure.
  const [now] = useState(() => Date.now());
  const byDay = new Map(points.map((p) => [p.day, p.value]));
  const days: { day: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, value: byDay.get(key) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.value));
  const total = days.reduce((sum, d) => sum + d.value, 0);
  return (
    <figure
      className="adm-bars"
      aria-label={`${label}: ${format(total)} in 30 days`}
    >
      <div className="adm-bars-plot">
        {days.map((d) => (
          <span
            key={d.day}
            title={`${d.day}: ${format(d.value)}`}
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            className={d.value ? "" : "zero"}
          />
        ))}
      </div>
      <figcaption className="xs mut">
        <span>{days[0].day.slice(5)}</span>
        <span>
          {format(total)} {label.toLowerCase()} · 30 days
        </span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

export const ACTION_LABEL: Record<string, string> = {
  "user.suspend": "Suspended user",
  "user.unsuspend": "Reactivated user",
  "user.sign_out_all": "Signed user out everywhere",
  "user.password_reset": "Sent password reset",
  "verification.verified": "Approved verification",
  "verification.action_required": "Asked for more information",
  "verification.rejected": "Rejected verification",
  "transactions.export": "Exported transactions",
  "waitlist.export": "Exported waitlist",
  "ticket.open": "Reopened ticket",
  "ticket.pending": "Marked ticket pending",
  "ticket.resolved": "Resolved ticket",
};
