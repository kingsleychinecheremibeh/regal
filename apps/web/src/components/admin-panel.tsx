"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { dateTime, label, money } from "@/lib/format";
import { Logo } from "@/components/logo";
import { Badge, Kpi, Seg, Table } from "@/components/dashboard/ui";

type Overview = {
  users: number;
  usersLastWeek: number;
  waitlist: number;
  messages: number;
  transactions: number;
  verification: Record<string, number>;
};
type User = {
  id: string;
  fullName: string;
  email: string;
  emailVerifiedAt: string | null;
  isAdmin: boolean;
  createdAt: string;
  kyc: string | null;
};
type Case = {
  userId: string;
  kind: "kyc" | "kyb";
  data: Record<string, unknown>;
  submittedAt: string | null;
  fullName: string;
  email: string;
};
type Tx = {
  id: string;
  kind: string;
  amountMinor: number;
  description: string;
  createdAt: string;
  email: string;
};
type Message = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
};

const TABS = [
  ["overview", "Overview"],
  ["verifications", "Verification queue"],
  ["users", "Users"],
  ["transactions", "Transactions"],
  ["messages", "Messages"],
] as const;
type Tab = (typeof TABS)[number][0];

function useList<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<T>(path)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [path]);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

function Summary({ value }: { value: Record<string, unknown> }) {
  return (
    <dl className="xs" style={{ margin: 0 }}>
      {Object.entries(value).map(([step, fields]) => (
        <div key={step}>
          <b>{label(step)}:</b>{" "}
          {typeof fields === "object" && fields
            ? Object.entries(fields)
                .filter(([, v]) => typeof v !== "object")
                .map(([k, v]) => `${label(k)} ${String(v)}`)
                .join(" · ")
            : String(fields)}
        </div>
      ))}
    </dl>
  );
}

function Queue({ onChange }: { onChange: () => void }) {
  const { data, error, reload } = useList<Case[]>("admin/verifications");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [failure, setFailure] = useState("");

  async function decide(c: Case, decision: string) {
    const key = c.userId + c.kind;
    setBusy(key);
    setFailure("");
    try {
      await api(`admin/verifications/${c.userId}/${c.kind}`, {
        body: { decision, ...(notes[key] ? { note: notes[key] } : {}) },
      });
      reload();
      onChange();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (error) return <p className="err-t">{error}</p>;
  if (!data) return <p className="mut">Loading…</p>;
  return (
    <>
      {failure && <p className="err-t">{failure}</p>}
      <Table
        head={["Customer", "Type", "Submitted", "Details", "Decision"]}
        empty="No cases waiting for review."
        rows={data.map((c) => {
          const key = c.userId + c.kind;
          return [
            <>
              <b>{c.fullName}</b>
              <div className="xs mut">{c.email}</div>
            </>,
            c.kind === "kyc" ? "Identity" : "Business",
            c.submittedAt ? dateTime(c.submittedAt) : "-",
            <Summary key="d" value={c.data} />,
            <div key="a" style={{ display: "grid", gap: 6, minWidth: 200 }}>
              <input
                aria-label="Note to customer"
                placeholder="Note (needed to reject or ask)"
                value={notes[key] ?? ""}
                onChange={(e) => setNotes({ ...notes, [key]: e.target.value })}
              />
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn-p btn-sm"
                  disabled={busy === key}
                  onClick={() => decide(c, "verified")}
                >
                  Approve
                </button>
                <button
                  className="btn btn-s btn-sm"
                  disabled={busy === key}
                  onClick={() => decide(c, "action_required")}
                >
                  Ask for info
                </button>
                <button
                  className="btn btn-s btn-sm"
                  disabled={busy === key}
                  onClick={() => decide(c, "rejected")}
                >
                  Reject
                </button>
              </div>
            </div>,
          ];
        })}
      />
    </>
  );
}

function Users() {
  const { data, error } = useList<User[]>("admin/users");
  const [q, setQ] = useState("");
  if (error) return <p className="err-t">{error}</p>;
  if (!data) return <p className="mut">Loading…</p>;
  const rows = data.filter((u) =>
    `${u.fullName} ${u.email}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <input
        className="mb"
        placeholder="Search name or email"
        aria-label="Search users"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 360 }}
      />
      <Table
        head={["Name", "Email", "Email status", "Identity", "Joined"]}
        rows={rows.map((u) => [
          <>
            {u.fullName} {u.isAdmin && <Badge tone="b-info" text="Admin" />}
          </>,
          u.email,
          u.emailVerifiedAt ? (
            <Badge status="verified" />
          ) : (
            <Badge tone="b-mut" text="Unverified" />
          ),
          <Badge key="k" status={u.kyc ?? "not_started"} />,
          dateTime(u.createdAt),
        ])}
      />
    </>
  );
}

function Transactions() {
  const { data, error } = useList<Tx[]>("admin/transactions");
  if (error) return <p className="err-t">{error}</p>;
  if (!data) return <p className="mut">Loading…</p>;
  return (
    <Table
      head={["Date", "Customer", "Type", "Description", "Amount"]}
      rows={data.map((t) => [
        dateTime(t.createdAt),
        t.email,
        label(t.kind),
        t.description,
        money(t.amountMinor / 100),
      ])}
    />
  );
}

function Messages() {
  const { data, error } = useList<Message[]>("admin/messages");
  if (error) return <p className="err-t">{error}</p>;
  if (!data) return <p className="mut">Loading…</p>;
  return (
    <Table
      head={["Received", "From", "Topic", "Message"]}
      rows={data.map((m) => [
        dateTime(m.createdAt),
        <>
          {m.name}
          <div className="xs mut">{m.email}</div>
        </>,
        label(m.topic),
        m.message,
      ])}
    />
  );
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const overview = useList<Overview>("admin/overview");
  const o = overview.data;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="site">
        <div className="wrap">
          <Logo />
          <b style={{ color: "#fff" }}>Admin</b>
          <Link
            className="btn btn-w btn-sm"
            href="/dashboard"
            style={{ justifySelf: "end" }}
          >
            My dashboard
          </Link>
        </div>
      </header>
      <main className="wrap" id="main" style={{ padding: "28px 20px" }}>
        <h1>Operations</h1>
        <div className="mb" style={{ overflowX: "auto" }}>
          <Seg items={TABS} value={tab} onChange={setTab} label="Admin" />
        </div>
        {tab === "overview" &&
          (o ? (
            <div className="grid g4">
              <Kpi
                title="Users"
                value={o.users}
                sub={`${o.usersLastWeek} joined in the last 7 days`}
              />
              <Kpi
                title="Waiting for review"
                value={o.verification.in_review ?? 0}
                sub={`${o.verification.verified ?? 0} verified`}
              />
              <Kpi title="Transactions" value={o.transactions} />
              <Kpi
                title="Waitlist and messages"
                value={o.waitlist + o.messages}
                sub={`${o.waitlist} waitlist · ${o.messages} messages`}
              />
            </div>
          ) : (
            <p className="mut">{overview.error || "Loading…"}</p>
          ))}
        {tab === "verifications" && <Queue onChange={overview.reload} />}
        {tab === "users" && <Users />}
        {tab === "transactions" && <Transactions />}
        {tab === "messages" && <Messages />}
      </main>
    </div>
  );
}
