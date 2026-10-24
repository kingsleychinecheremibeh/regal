"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";
import { useAction, useDash, useData } from "./context";
import {
  Badge,
  Empty,
  Field,
  Gate,
  Kpi,
  Modal,
  PageHead,
  Skeleton,
  Table,
} from "./ui";

type Data = {
  kpis: {
    volumeUsd: number;
    successRate: number;
    nextSettlementUsd: number;
    openDisputes: number;
  };
  links: {
    id: string;
    title: string;
    amount: number;
    currency: string;
    status: string;
  }[];
  keys: { id: string; name: string; last4: string; createdAt: string }[];
  payments: {
    date: string;
    method: string;
    amountUsd: number;
    status: string;
    reconciled: boolean;
  }[];
  settlements: { period: string; gross: number; fees: number; net: number }[];
  webhooks: { url: string; lastDelivery: string; result: string }[];
};

export function Acquiring() {
  const { state } = useDash();
  const business = state?.profile.accountType === "business";
  const unlocked =
    state?.verification.kyc?.status === "verified" &&
    state?.verification.kyb?.status === "verified";
  const { data } = useData<Data>(
    business && unlocked ? "demo/acquiring" : null,
  );
  const { pending, run } = useAction();
  const [modal, setModal] = useState<"link" | "key" | null>(null);
  const [form, setForm] = useState({ title: "", amount: "", name: "" });
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  if (!state) return <Skeleton />;
  if (!business)
    return (
      <>
        <PageHead
          title="Fiat Acquiring"
          sub="Accept payments for your business."
        />
        <div className="card pad">
          <Empty
            title="Business accounts only"
            action={
              <Link
                className="btn btn-d"
                href="/dashboard/settings?tab=Verification"
              >
                Switch to a business account
              </Link>
            }
          >
            Switch your account type to business and complete business
            verification (KYB) to accept payments.
          </Empty>
        </div>
      </>
    );

  async function createLink() {
    setError("");
    const result = await run(
      () =>
        api("demo/acquiring/links", {
          body: { title: form.title, amount: form.amount },
        }),
      { success: "Payment link created.", onError: setError },
    );
    if (result) setModal(null);
  }
  async function createKey() {
    setError("");
    const result = await run(
      () =>
        api<{ key: string }>("demo/acquiring/keys", {
          body: { name: form.name },
        }),
      { onError: setError },
    );
    if (result) {
      setModal(null);
      setSecret(result.key);
    }
  }

  return (
    <>
      <PageHead
        title="Fiat Acquiring"
        sub="Cards, wallets and local bank transfers through one integration."
      />
      <Gate product="acquiring" />
      {!unlocked ? null : !data ? (
        <Skeleton />
      ) : (
        <>
          <div className="notice info">
            Sandbox view. Volume, payments, settlements and webhooks are sample
            data. Payment links and API keys you create are stored but cannot
            take real payments.
          </div>
          <div className="grid g4 mb">
            <Kpi
              title="Volume (30 days)"
              value={money(data.kpis.volumeUsd)}
              sub="Sample"
            />
            <Kpi
              title="Success rate"
              value={`${data.kpis.successRate}%`}
              sub="Sample"
            />
            <Kpi
              title="Next settlement"
              value={money(data.kpis.nextSettlementUsd)}
              sub="Expected tomorrow"
            />
            <Kpi
              title="Open disputes"
              value={data.kpis.openDisputes}
              sub="Sample"
            />
          </div>
          <div className="grid g2 mb">
            <div className="card pad">
              <div className="row sp">
                <h3 className="m0">Payment links</h3>
                <button
                  className="btn btn-s btn-sm"
                  onClick={() => setModal("link")}
                >
                  Create link
                </button>
              </div>
              <div className="mt">
                <Table
                  head={["Link", "Amount", "Status"]}
                  rows={data.links.map((l) => [
                    l.title,
                    money(l.amount, l.currency),
                    <Badge key="s" status={l.status} />,
                  ])}
                  empty="No payment links yet."
                />
              </div>
            </div>
            <div className="card pad">
              <div className="row sp">
                <h3 className="m0">API keys</h3>
                <button
                  className="btn btn-s btn-sm"
                  onClick={() => setModal("key")}
                >
                  Create key
                </button>
              </div>
              <div className="mt">
                <Table
                  head={["Name", "Key", "Created", ""]}
                  rows={data.keys.map((k) => [
                    k.name,
                    <code key="k">txg_demo_••••{k.last4}</code>,
                    date(k.createdAt),
                    <button
                      key="r"
                      className="btn btn-s btn-sm"
                      onClick={() =>
                        run(
                          () =>
                            api(`demo/acquiring/keys/${k.id}`, {
                              method: "DELETE",
                            }),
                          {
                            success: "Key revoked.",
                          },
                        )
                      }
                    >
                      Revoke
                    </button>,
                  ])}
                  empty="No API keys yet."
                />
              </div>
              <p className="xs mut mt m0">
                Keys are shown once when created, stored hashed and can be
                revoked.
              </p>
            </div>
          </div>
          <div className="card pad mb">
            <h3>Payments</h3>
            <Table
              head={["Date", "Method", "Amount", "Status", "Reconciled"]}
              rows={data.payments.map((p) => [
                date(p.date),
                p.method,
                money(p.amountUsd),
                <Badge key="s" status={p.status} />,
                p.reconciled ? "Yes" : "No",
              ])}
            />
          </div>
          <div className="grid g2">
            <div className="card pad">
              <h3>Settlement reports</h3>
              <Table
                head={["Period", "Gross", "Fees", "Net"]}
                rows={data.settlements.map((s) => [
                  s.period,
                  money(s.gross),
                  money(s.fees),
                  money(s.net),
                ])}
              />
            </div>
            <div className="card pad">
              <h3>Webhook endpoints</h3>
              <Table
                head={["Endpoint", "Last delivery", "Result"]}
                rows={data.webhooks.map((w) => [
                  <code key="u">{w.url}</code>,
                  dateTime(w.lastDelivery),
                  <Badge key="r" status={w.result} />,
                ])}
              />
              <p className="xs mut mt m0">
                Failed deliveries retry with back-off. The signing secret is
                shown once.
              </p>
            </div>
          </div>
        </>
      )}

      {modal === "link" && (
        <Modal
          title="Create payment link"
          onClose={() => setModal(null)}
          actions={
            <button
              className="btn btn-d"
              onClick={createLink}
              disabled={pending}
            >
              Create
            </button>
          }
        >
          <Field label="Title" id="l-t">
            <input
              id="l-t"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Amount (USD)" id="l-a">
            <input
              id="l-a"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <p className="err-t" role="alert">
            {error}
          </p>
        </Modal>
      )}
      {modal === "key" && (
        <Modal
          title="New API key"
          onClose={() => setModal(null)}
          actions={
            <button
              className="btn btn-d"
              onClick={createKey}
              disabled={pending}
            >
              Create key
            </button>
          }
        >
          <Field label="Key name" id="k-n">
            <input
              id="k-n"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <p className="err-t" role="alert">
            {error}
          </p>
          <p className="xs mut">
            The full key is shown once after creation. It is stored hashed and
            cannot be shown again.
          </p>
        </Modal>
      )}
      {secret && (
        <Modal title="Copy your key now" onClose={() => setSecret(null)}>
          <div className="notice">
            This is the only time the full key is shown.
          </div>
          <code style={{ wordBreak: "break-all" }}>{secret}</code>
          <p className="xs mut mt">Demo keys cannot call any live service.</p>
        </Modal>
      )}
    </>
  );
}
