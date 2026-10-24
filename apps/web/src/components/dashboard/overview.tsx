"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { label, money, qty } from "@/lib/format";
import type { Markets, Overview as Data } from "@/lib/types";
import { Bar, Donut } from "./charts";
import { useDash, useData } from "./context";
import { FundsModal } from "./funds";
import { TxTable } from "./tx";
import {
  Badge,
  Empty,
  Kpi,
  LoadError,
  Modal,
  PageHead,
  Skeleton,
  Table,
  useMask,
} from "./ui";

const QUICK = [
  ["Deposit", "deposit"],
  ["Withdraw", "withdraw"],
  ["Send", "/dashboard/turboxpay"],
  ["Receive", "receive"],
  ["Buy", "/dashboard/tradehub?side=buy"],
  ["Sell", "/dashboard/tradehub?side=sell"],
  ["Swap", "/dashboard/tradehub?side=swap"],
  ["Convert", "/dashboard/accounts"],
  ["View Accounts", "/dashboard/accounts"],
  ["Manage Cards", "/dashboard/cards"],
] as const;

export function Overview() {
  const router = useRouter();
  const { state, verified } = useDash();
  const mask = useMask();
  const { data, error } = useData<Data>("demo/overview");
  const markets = useData<Markets>("demo/markets");
  const [funds, setFunds] = useState<"deposit" | "withdraw" | "receive" | null>(
    null,
  );
  const [locked, setLocked] = useState(false);

  if (error) return <LoadError message={error} />;
  if (!data || !state) return <Skeleton />;

  const kyc = state.verification.kyc?.status ?? "not_started";
  const fiat = (c: string) =>
    data.holdings.find((h) => h.asset === c)?.quantity ?? 0;
  const digital = data.holdings.filter((h) => h.kind === "digital");
  const allocation = [
    {
      label: "Cash balances",
      value: data.holdings
        .filter((h) => h.kind === "cash")
        .reduce((s, h) => s + h.usd, 0),
    },
    ...digital.map((h) => ({ label: h.asset, value: h.usd })),
    {
      label: "Investments",
      value: data.holdings
        .filter((h) => h.kind === "investment")
        .reduce((s, h) => s + h.usd, 0),
    },
  ].filter((item) => item.value > 0);

  const todo: [string, string][] = [];
  if (kyc !== "verified")
    todo.push([
      kyc === "in_review"
        ? "Your verification is in review"
        : kyc === "action_required"
          ? "Add the information we asked for"
          : kyc === "rejected"
            ? "Resubmit your verification"
            : "Verify your identity to unlock products",
      "/dashboard/settings?tab=Verification",
    ]);
  if (
    state.profile.accountType === "business" &&
    state.verification.kyb?.status !== "verified"
  )
    todo.push([
      "Complete business verification (KYB)",
      "/dashboard/settings?tab=Verification",
    ]);
  if (!state.profile.mfaEnabled)
    todo.push([
      "Turn on multi-factor authentication",
      "/dashboard/settings?tab=Security",
    ]);
  if (data.pending)
    todo.push([
      `${data.pending} transaction(s) processing`,
      "/dashboard/transactions",
    ]);

  const products: [string, string, boolean?][] = [
    ["TradeHUB", "tradehub"],
    ["TurboXPay", "turboxpay"],
    ["Global Accounts", "accounts"],
    ["Virtual Cards", "cards"],
    ["Wealth", "wealth"],
    ["Fiat Acquiring", "acquiring", true],
  ];

  function quick(target: string) {
    if (!verified) return setLocked(true);
    if (target === "deposit" || target === "withdraw" || target === "receive")
      return setFunds(target);
    router.push(target);
  }

  return (
    <>
      <PageHead
        title="Overview"
        sub="Your money, tasks and access at a glance."
      />
      <div className="grid g4 mb">
        <Kpi
          title="Total portfolio value"
          value={mask(money(data.totalUsd))}
          sub={
            data.holdings.length ? "At illustrative prices" : "No holdings yet"
          }
        />
        {(["USD", "EUR", "GBP"] as const).map((c) => (
          <Kpi
            key={c}
            title={`${c} balance`}
            value={mask(money(fiat(c), c))}
            sub="Global account"
          />
        ))}
      </div>

      <div className="card pad mb">
        <div className="b mb">Quick actions</div>
        <div className="row">
          {QUICK.map(([text, target]) => (
            <button
              key={text}
              className="btn btn-s btn-sm"
              onClick={() => quick(target)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="grid g2 mb">
        <div className="card pad">
          <h3>Digital assets</h3>
          <Table
            head={["Asset", "Balance", "Value"]}
            rows={digital.map((h) => [
              h.asset,
              mask(qty(h.quantity)),
              mask(money(h.usd)),
            ])}
            empty="No digital assets yet. Buy your first asset in TradeHUB."
          />
        </div>
        <div className="card pad">
          <h3>Allocation</h3>
          {allocation.length ? (
            <Donut items={allocation} />
          ) : (
            <Empty title="No holdings yet">
              Verify and fund your account to see your allocation.
            </Empty>
          )}
        </div>
      </div>

      <div className="grid g2 mb">
        <div className="card pad">
          <h3>Pending actions</h3>
          {todo.length ? (
            todo.map(([text, href]) => (
              <div className="lrow" key={text}>
                <span>{text}</span>
                <Link className="btn btn-s btn-sm" href={href}>
                  Open
                </Link>
              </div>
            ))
          ) : (
            <Empty title="All caught up">Nothing needs your attention.</Empty>
          )}
        </div>
        <div className="card pad">
          <h3>Verification, limits and security</h3>
          <div className="row sp mb">
            <span>Identity verification</span>
            <Badge status={kyc} />
          </div>
          {state.profile.accountType === "business" && (
            <div className="row sp mb">
              <span>Business verification</span>
              <Badge status={state.verification.kyb?.status ?? "not_started"} />
            </div>
          )}
          {(
            [
              ["Daily trading limit", data.limits.trading],
              ["Daily transfer limit", data.limits.transfers],
            ] as const
          ).map(([text, limit]) => (
            <div className="mb" key={text}>
              <div className="row sp sm">
                <span>{text}</span>
                <span>
                  {verified
                    ? mask(`${money(limit.used)} of ${money(limit.max)}`)
                    : "Not available until verified"}
                </span>
              </div>
              <Bar used={verified ? limit.used : 0} max={limit.max} />
            </div>
          ))}
          <div className="row sp">
            <span>Multi-factor authentication</span>
            <Badge
              tone={state.profile.mfaEnabled ? "b-ok" : "b-warn"}
              text={state.profile.mfaEnabled ? "On" : "Off"}
            />
          </div>
        </div>
      </div>

      <div className="grid g2 mb">
        <div className="card pad">
          <h3>Product access</h3>
          <Table
            head={["Product", "Status", ""]}
            rows={products
              .filter(
                ([, , biz]) => !biz || state.profile.accountType === "business",
              )
              .map(([name, slug, biz]) => {
                const kyb = state.verification.kyb?.status;
                const status = !verified
                  ? ["Verification required", "b-warn"]
                  : biz && kyb !== "verified"
                    ? ["Business verification required", "b-warn"]
                    : ["Available", "b-ok"];
                return [
                  name,
                  <Badge key="s" tone={status[1]} text={status[0]} />,
                  <Link
                    key="o"
                    className="btn btn-s btn-sm"
                    href={`/dashboard/${slug}`}
                  >
                    Open
                  </Link>,
                ];
              })}
          />
        </div>
        <div className="card pad">
          <h3>Watchlist</h3>
          <Table
            head={["Asset", "Price", "24h", ""]}
            rows={(markets.data?.assets ?? [])
              .filter((a) => a.watching)
              .map((a) => [
                a.name,
                money(a.price),
                <span key="c" className={a.change >= 0 ? "up" : "dn"}>
                  {a.change >= 0 ? "+" : ""}
                  {a.change}%
                </span>,
                <Link
                  key="t"
                  className="btn btn-s btn-sm"
                  href={`/dashboard/tradehub?symbol=${a.symbol}`}
                >
                  Trade
                </Link>,
              ])}
            empty="Your watchlist is empty. Star assets in TradeHUB."
          />
        </div>
      </div>

      <div className="card pad mb">
        <h3>Global accounts</h3>
        <div className="row">
          {data.accounts.map((a) => (
            <span
              key={a.currency}
              className="row"
              style={{ gap: 6, marginRight: 14 }}
            >
              <b>{a.currency}</b>{" "}
              <Badge status={a.status} text={label(a.status)} />
            </span>
          ))}
        </div>
      </div>

      <div className="card pad">
        <div className="row sp">
          <h3 className="m0">Recent transactions</h3>
          <Link className="btn btn-s btn-sm" href="/dashboard/transactions">
            View all
          </Link>
        </div>
        <div className="mt">
          <TxTable rows={data.recent} />
        </div>
      </div>

      {funds && <FundsModal kind={funds} onClose={() => setFunds(null)} />}
      {locked && (
        <Modal
          title="This action is not available yet"
          onClose={() => setLocked(false)}
          actions={
            <Link
              className="btn btn-d"
              href="/dashboard/settings?tab=Verification"
            >
              Go to verification
            </Link>
          }
        >
          <p>
            {kyc === "in_review"
              ? "Your verification is in review. This unlocks as soon as it is approved."
              : "Verify your identity to use this feature."}
          </p>
        </Modal>
      )}
    </>
  );
}
