"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Empty } from "@/components/dashboard/ui";
import { dateTime } from "@/lib/format";
import { Head, Notice, useAction, useAdmin, useCan } from "./shared";

type Case = {
  userId: string;
  kind: "kyc" | "kyb";
  status: string;
  data: Record<string, unknown>;
  note: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  fullName: string;
  email: string;
};

const VIEWS = [
  ["in_review", "Waiting"],
  ["action_required", "Needs info"],
  ["verified", "Approved"],
  ["rejected", "Rejected"],
  ["all", "All"],
] as const;

/** "dateOfBirth" or "date_of_birth" → "Date of birth". */
const human = (key: string) => {
  const text = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const show = (value: unknown): string => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value && typeof value === "object") {
    const file = value as { name?: string; method?: string };
    if (file.name) return `File: ${file.name}`;
    if (file.method) return human(file.method);
    return "Provided";
  }
  return String(value ?? "—");
};

/** The submitted answers, grouped by the step they were given in. */
export function CaseDetails({ data }: { data: Record<string, unknown> }) {
  const steps = Object.entries(data ?? {});
  if (!steps.length) return <p className="xs mut">No details submitted.</p>;
  return (
    <div className="adm-steps">
      {steps.map(([step, fields]) => (
        <div key={step}>
          <h4>{human(step)}</h4>
          {fields && typeof fields === "object" && !Array.isArray(fields) ? (
            <dl className="adm-kv sm">
              {Object.entries(fields as Record<string, unknown>).map(
                ([k, v]) => (
                  <div key={k} className="contents">
                    <dt>{human(k)}</dt>
                    <dd>{show(v)}</dd>
                  </div>
                ),
              )}
            </dl>
          ) : (
            <p className="xs">{show(fields)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminVerifications() {
  const [view, setView] = useState<string>("in_review");
  const { data, error, reload } = useAdmin<Case[]>(
    `admin/verifications?status=${view}`,
  );
  const { busy, notice, run } = useAction(reload);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const can = useCan();

  return (
    <>
      <Head
        title="Verification queue"
        sub="Identity and business checks submitted from the sandbox. Approving identity credits the sandbox opening balance."
      />
      <div className="seg mb" role="group" aria-label="Show">
        {VIEWS.map(([key, text]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {text}
          </button>
        ))}
      </div>
      <Notice notice={notice} />
      {error && <p className="err-t">{error}</p>}
      {!data ? (
        <p className="mut">Loading…</p>
      ) : !data.length ? (
        <div className="card pad">
          <Empty
            title={view === "in_review" ? "All caught up" : "Nothing here"}
          >
            <p className="mut m0">
              {view === "in_review"
                ? "No verifications are waiting for a decision."
                : "No cases with this status."}
            </p>
          </Empty>
        </div>
      ) : (
        <div className="adm-cases">
          {data.map((c) => {
            const key = c.userId + c.kind;
            const note = notes[key] ?? "";
            const decide = (decision: string) =>
              run(key, `admin/verifications/${c.userId}/${c.kind}`, {
                decision,
                ...(note ? { note } : {}),
              });
            return (
              <article key={key} className="card pad adm-case">
                <div className="row sp">
                  <div>
                    <Link
                      href={`/admin/users/${c.userId}`}
                      className="adm-user"
                    >
                      <b>{c.fullName}</b>
                      <span className="xs mut">{c.email}</span>
                    </Link>
                  </div>
                  <div className="row">
                    <Badge
                      tone="b-info"
                      text={c.kind === "kyc" ? "Identity" : "Business"}
                    />
                    <Badge status={c.status} />
                  </div>
                </div>
                <p className="xs mut">
                  Submitted {c.submittedAt ? dateTime(c.submittedAt) : "—"}
                  {c.decidedAt && ` · decided ${dateTime(c.decidedAt)}`}
                  {c.note && ` · note: ${c.note}`}
                </p>
                <CaseDetails data={c.data} />
                {c.status === "in_review" && can("decide") && (
                  <div className="adm-decide">
                    <input
                      aria-label="Note to the customer"
                      placeholder="Note to the customer (required to reject or ask for info)"
                      maxLength={300}
                      value={note}
                      onChange={(e) =>
                        setNotes({ ...notes, [key]: e.target.value })
                      }
                    />
                    <div className="row">
                      <button
                        className="btn btn-p btn-sm"
                        disabled={!!busy}
                        onClick={() => decide("verified")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-s btn-sm"
                        disabled={!!busy || !note}
                        onClick={() => decide("action_required")}
                      >
                        Ask for info
                      </button>
                      <button
                        className="btn btn-d btn-sm"
                        disabled={!!busy || !note}
                        onClick={() => decide("rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
