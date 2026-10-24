"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { label } from "@/lib/format";
import { useDash } from "./context";

const BADGE: Record<string, string> = {
  completed: "b-ok",
  verified: "b-ok",
  active: "b-ok",
  ready: "b-ok",
  paid: "b-ok",
  settled: "b-ok",
  pending: "b-warn",
  in_review: "b-warn",
  open: "b-warn",
  provisioning: "b-warn",
  action_required: "b-warn",
  failed: "b-err",
  rejected: "b-err",
  frozen: "b-err",
  reversed: "b-info",
};

export function Badge({
  status,
  text,
  tone,
}: {
  status?: string;
  text?: string;
  tone?: string;
}) {
  const key = (status ?? "").toLowerCase().replace(/ /g, "_");
  return (
    <span className={`badge ${tone ?? BADGE[key] ?? "b-mut"}`}>
      {text ?? label(key)}
    </span>
  );
}

export function PageHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="row sp mb">
      <div>
        <h1>{title}</h1>
        {sub && <p className="mut m0">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  title,
  value,
  sub,
}: {
  title: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="card kpi">
      <small>{title}</small>
      <div className="v">{value}</div>
      {sub && <div className="xs mut">{sub}</div>}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
      {action && <div className="mt">{action}</div>}
    </div>
  );
}

export function Table({
  head,
  rows,
  empty = "Nothing here yet.",
}: {
  head: React.ReactNode[];
  rows: React.ReactNode[][];
  empty?: React.ReactNode;
}) {
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th scope="col" key={index}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={head.length}>
                <div className="empty">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item}
          className="tab"
          role="tab"
          aria-selected={value === item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({
  items,
  value,
  onChange,
  label: aria,
}: {
  items: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={aria}>
      {items.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label: aria,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="tgl"
      role="switch"
      aria-checked={checked}
      aria-label={aria}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Modal({
  title,
  onClose,
  children,
  actions,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>("input, select, textarea, button")
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="ov"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
      >
        <h3 id={id}>{title}</h3>
        {children}
        <div className="row mt end">
          {actions}
          <button className="btn btn-s" type="button" onClick={onClose}>
            {actions ? "Cancel" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div
        className="skel"
        style={{ height: 34, width: 240, marginBottom: 10 }}
      />
      <div
        className="skel"
        style={{ height: 16, width: 360, maxWidth: "100%", marginBottom: 22 }}
      />
      <div className="grid g4 mb">
        {[1, 2, 3, 4].map((n) => (
          <div className="skel" key={n} style={{ height: 92 }} />
        ))}
      </div>
      <div className="grid g2">
        <div className="skel" style={{ height: 240 }} />
        <div className="skel" style={{ height: 240 }} />
      </div>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <div className="notice err" role="alert">
      {message}
    </div>
  );
}

/** Explain why a product is locked and link to the next step. */
export function Gate({
  product = "personal",
}: {
  product?: "personal" | "acquiring";
}) {
  const { state } = useDash();
  if (!state) return null;
  const kyc = state.verification.kyc?.status ?? "not_started";
  const messages: Record<string, string> = {
    not_started: "Verify your identity to use this feature.",
    in_review:
      "Your verification is in review. This unlocks as soon as it is approved.",
    action_required: "We need more information to finish your verification.",
    rejected:
      "Your verification was not approved. Review the note and resubmit.",
  };
  let message = kyc === "verified" ? "" : messages[kyc];
  if (!message && product === "acquiring") {
    const kyb = state.verification.kyb?.status ?? "not_started";
    if (kyb !== "verified")
      message =
        kyb === "in_review"
          ? "Your business verification is in review. Fiat Acquiring unlocks once it is approved."
          : "Verify your business to use Fiat Acquiring.";
  }
  if (!message) return null;
  return (
    <div className="notice err" role="alert">
      {message}{" "}
      <Link
        href="/dashboard/settings?tab=Verification"
        style={{ fontWeight: 700 }}
      >
        Go to verification
      </Link>
    </div>
  );
}

export function Field({
  label: text,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{text}</label>
      {children}
      {hint && <span className="xs mut">{hint}</span>}
    </div>
  );
}

export function useMask() {
  const { hide } = useDash();
  return (value: string) => (hide ? "••••••" : value);
}
