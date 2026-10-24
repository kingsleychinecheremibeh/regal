"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { FIAT, TYPE_LABEL, date, dateTime, money } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { useAction, useDash, useData } from "./context";
import { TxTable } from "./tx";
import { Badge, Empty, Field, Kpi, PageHead, Seg, Skeleton, Table } from "./ui";

const TYPES = Object.keys(TYPE_LABEL);
const STATUSES = ["completed", "pending", "failed", "reversed"];

export function Transactions() {
  const [filters, setFilters] = useState({
    q: "",
    type: "",
    status: "",
    currency: "",
    sort: "date",
    dir: "desc",
    page: 1,
  });
  const query = new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  const { data } = useData<{
    rows: Tx[];
    total: number;
    everything: number;
    page: number;
    pages: number;
  }>(`demo/transactions?${query}`);
  const set = (patch: Partial<typeof filters>) =>
    setFilters({ ...filters, page: 1, ...patch });
  const sortBy = (sort: "date" | "amount") =>
    set({
      sort,
      dir: filters.sort === sort && filters.dir === "desc" ? "asc" : "desc",
    });
  const filtered =
    filters.q || filters.type || filters.status || filters.currency;
  const exportQuery = new URLSearchParams(
    Object.entries({ ...filters, page: "" })
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return (
    <>
      <PageHead
        title="Transactions"
        sub="Search, filter and open any transaction."
        action={
          <a
            className="btn btn-s btn-sm"
            href={`/api/v1/demo/transactions/export.csv?${exportQuery}`}
          >
            Export CSV
          </a>
        }
      />
      <div className="card pad mb">
        <div className="row">
          <input
            placeholder="Search description or reference"
            aria-label="Search"
            style={{ maxWidth: 280 }}
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
          />
          <select
            aria-label="Type"
            style={{ width: "auto" }}
            value={filters.type}
            onChange={(e) => set({ type: e.target.value })}
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            style={{ width: "auto" }}
            value={filters.status}
            onChange={(e) => set({ status: e.target.value })}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            aria-label="Currency"
            style={{ width: "auto" }}
            value={filters.currency}
            onChange={(e) => set({ currency: e.target.value })}
          >
            <option value="">All currencies</option>
            {FIAT.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {filtered && (
            <button
              className="btn btn-s btn-sm"
              onClick={() => set({ q: "", type: "", status: "", currency: "" })}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="row mt sm">
          <span className="mut">Sort by</span>
          <button className="btn btn-s btn-sm" onClick={() => sortBy("date")}>
            Date
            {filters.sort === "date"
              ? filters.dir === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </button>
          <button className="btn btn-s btn-sm" onClick={() => sortBy("amount")}>
            Amount
            {filters.sort === "amount"
              ? filters.dir === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </button>
        </div>
      </div>
      {!data ? (
        <Skeleton />
      ) : data.everything === 0 ? (
        <div className="card pad">
          <Empty
            title="No transactions yet"
            action={
              <Link className="btn btn-d" href="/dashboard/accounts">
                Make a deposit
              </Link>
            }
          >
            When you deposit, trade or pay, it shows up here.
          </Empty>
        </div>
      ) : (
        <>
          <TxTable
            rows={data.rows}
            empty="No transactions match these filters."
          />
          <div className="pg">
            <span className="sm mut">
              {data.total} results · page {data.page} of {data.pages}
            </span>
            <button
              className="btn btn-s btn-sm"
              disabled={data.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Previous
            </button>
            <button
              className="btn btn-s btn-sm"
              disabled={data.page >= data.pages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function Statements() {
  const { verified } = useDash();
  const { data } = useData<string[]>("demo/statements");
  const [account, setAccount] = useState("ALL");
  const [period, setPeriod] = useState("");
  const current = new Date().toISOString().slice(0, 7);
  const periods = data?.length ? data : [current];
  const chosen = period || periods[0];
  const link = (p: string, format: "html" | "csv", acct = account) =>
    `/api/v1/demo/statements/${p}?account=${acct}&format=${format}`;
  const label = (p: string) =>
    new Date(`${p}-01T00:00:00Z`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      <PageHead
        title="Statements and Reports"
        sub="Generate statements from your ledger history."
      />
      <div className="card pad mb" style={{ maxWidth: 640 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <Field label="Account" id="s-acct">
              <select
                id="s-acct"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="ALL">All accounts</option>
                {FIAT.map((c) => (
                  <option key={c} value={c}>
                    {c} account
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grow">
            <Field label="Period" id="s-period">
              <select
                id="s-period"
                value={chosen}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {label(p)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="row">
          <a
            className="btn btn-d"
            href={link(chosen, "html")}
            target="_blank"
            rel="noopener"
            aria-disabled={!verified}
            onClick={(e) => !verified && e.preventDefault()}
          >
            Open statement
          </a>
          <a
            className="btn btn-s"
            href={link(chosen, "csv")}
            aria-disabled={!verified}
            onClick={(e) => !verified && e.preventDefault()}
          >
            Download CSV
          </a>
          <span className="xs mut">
            The statement opens in a new tab; use Print to save it as a PDF.
          </span>
        </div>
      </div>
      {!data ? (
        <Skeleton />
      ) : (
        <Table
          head={["Period", "Account", "Status", ""]}
          rows={data.map((p) => [
            label(p),
            "All accounts",
            <Badge key="s" tone="b-ok" text="Ready" />,
            <span key="d" className="row">
              <a
                className="btn btn-s btn-sm"
                href={link(p, "html", "ALL")}
                target="_blank"
                rel="noopener"
              >
                View
              </a>
              <a className="btn btn-s btn-sm" href={link(p, "csv", "ALL")}>
                CSV
              </a>
            </span>,
          ])}
          empty="No statements yet. Activity in a month makes its statement available."
        />
      )}
    </>
  );
}

type Note = {
  id: string;
  message: string;
  category: string;
  readAt: string | null;
  createdAt: string;
};

export function Notifications() {
  const { data } = useData<Note[]>("demo/notifications");
  const { run } = useAction();
  const [filter, setFilter] = useState<
    "All" | "Unread" | "Payments" | "Security" | "Account"
  >("All");
  if (!data) return <Skeleton />;
  const rows = data.filter((n) =>
    filter === "All"
      ? true
      : filter === "Unread"
        ? !n.readAt
        : n.category === filter,
  );
  return (
    <>
      <PageHead
        title="Notifications"
        sub="Account, payment and security alerts."
        action={
          <button
            className="btn btn-s btn-sm"
            onClick={() =>
              run(() => api("demo/notifications/read", { method: "POST" }))
            }
          >
            Mark all as read
          </button>
        }
      />
      <div className="mb">
        <Seg
          label="Filter"
          items={(
            ["All", "Unread", "Payments", "Security", "Account"] as const
          ).map((f) => [f, f] as const)}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div className="card pad">
        {rows.length ? (
          rows.map((n) => (
            <div className="lrow" key={n.id}>
              <span>
                {n.readAt ? "" : "● "}
                {n.message}
                <div className="xs mut">
                  {n.category} · {dateTime(n.createdAt)}
                </div>
              </span>
              {!n.readAt && (
                <button
                  className="btn btn-s btn-sm"
                  onClick={() =>
                    run(() =>
                      api(`demo/notifications/${n.id}/read`, {
                        method: "POST",
                      }),
                    )
                  }
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty title="No notifications">
            Alerts about your account will appear here.
          </Empty>
        )}
      </div>
      <p className="xs mut mt">
        Security alerts cannot be switched off. Manage the rest in Settings.
      </p>
    </>
  );
}

export function Referrals() {
  const { toast } = useDash();
  const { data } = useData<{
    code: string;
    stats: { invited: number; qualified: number; earnedUsd: number };
    history: { friend: string; status: string; rewardUsd: number | null }[];
  }>("demo/referrals");
  if (!data) return <Skeleton />;
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/sign-up?ref=${data!.code}`,
      );
      toast("Referral link copied.");
    } catch {
      toast("Copy is not available in this browser.", "warn");
    }
  }
  return (
    <>
      <PageHead
        title="Referrals and Rewards"
        sub="Invite friends. Shown only when the referral program is switched on."
      />
      <div className="grid g2">
        <div className="card pad">
          <h3>Your code</h3>
          <div className="row">
            <code
              style={{
                fontSize: 20,
                padding: "8px 12px",
                background: "var(--soft)",
                borderRadius: 8,
              }}
            >
              {data.code}
            </code>
            <button className="btn btn-s btn-sm" onClick={copy}>
              Copy link
            </button>
          </div>
          <p className="sm mut mt m0">
            You and your friend are rewarded when they verify and complete their
            first qualifying transaction. Full terms apply.
          </p>
        </div>
        <div className="grid g3">
          <Kpi title="Invited" value={data.stats.invited} sub="Sample" />
          <Kpi title="Qualified" value={data.stats.qualified} sub="Sample" />
          <Kpi
            title="Rewards earned"
            value={money(data.stats.earnedUsd)}
            sub="Sample"
          />
        </div>
      </div>
      <div className="card pad mt">
        <div className="row sp">
          <h3 className="m0">Referral history</h3>
          <Badge tone="b-gold" text="Sample data" />
        </div>
        <div className="mt">
          <Table
            head={["Friend", "Status", "Reward"]}
            rows={data.history.map((h) => [
              h.friend,
              <Badge key="s" status={h.status} text={h.status} />,
              h.rewardUsd === null ? "Pending" : money(h.rewardUsd),
            ])}
          />
        </div>
        <p className="xs mut mt m0">
          Rewards would be credited through ledger postings and appear in
          Transactions.
        </p>
      </div>
    </>
  );
}

const FAQS: [string, string][] = [
  [
    "How do I verify my identity?",
    "Open Settings, then Verification, and complete the steps. In the preview, use sample data and the demo reviewer to approve.",
  ],
  [
    "Why is my payment pending?",
    "Payments move through authorisation, processing and settlement. In the preview, pending items complete after a few seconds.",
  ],
  [
    "How do I freeze my card?",
    "Open Virtual Cards and select Freeze. It takes effect immediately.",
  ],
  [
    "What are my limits?",
    "See Settings, then Limits. They depend on your verification level.",
  ],
  [
    "How do I reset the demo?",
    "Open Settings, then Demo data. You can reset balances only, or start over as a new user.",
  ],
];

type Ticket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  createdAt: string;
};

export function Help() {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ subject: "", body: "" });
  const [error, setError] = useState("");
  const { pending, run } = useAction();
  const { data } = useData<Ticket[]>("demo/tickets");
  async function submit() {
    setError("");
    const result = await run(() => api("demo/tickets", { body: form }), {
      success: "Ticket submitted.",
      onError: setError,
    });
    if (result) setForm({ subject: "", body: "" });
  }
  const faqs = FAQS.filter(([q, a]) =>
    `${q} ${a}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Help and Support"
        sub="Find answers or contact our team."
      />
      <div className="card pad mb">
        <input
          placeholder="Search help articles"
          aria-label="Search help"
          style={{ maxWidth: 420 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt faq">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <div>{a}</div>
            </details>
          ))}
          {!faqs.length && <p className="mut">No articles match.</p>}
        </div>
      </div>
      <div className="grid g2">
        <div className="card pad">
          <h3>Open a ticket</h3>
          <Field label="Subject" id="h-s">
            <input
              id="h-s"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>
          <Field label="Details" id="h-m">
            <textarea
              id="h-m"
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          <p className="err-t" role="alert">
            {error}
          </p>
          <button className="btn btn-d" onClick={submit} disabled={pending}>
            Submit
          </button>
          <p className="xs mut mt m0">
            Demo tickets are stored with your account but are not monitored by
            staff.
          </p>
        </div>
        <div className="card pad">
          <h3>Your tickets</h3>
          <Table
            head={["ID", "Subject", "Status", "Opened"]}
            rows={(data ?? []).map((t) => [
              `T-${t.number}`,
              t.subject,
              <Badge key="s" status={t.status} />,
              date(t.createdAt),
            ])}
            empty="No tickets yet."
          />
          <h3 className="mt">Other ways to reach us</h3>
          <p className="sm mut m0">
            Use the <Link href="/contact">contact form</Link> on the public
            site.
          </p>
        </div>
      </div>
    </>
  );
}
