"use client";

import { useRef, useState } from "react";
import { api, newKey } from "@/lib/api";
import { FIAT, date, money } from "@/lib/format";
import type { Overview, Tx } from "@/lib/types";
import { useAction, useDash, useData } from "./context";
import { FundsModal } from "./funds";
import {
  Badge,
  Field,
  Gate,
  LoadError,
  Modal,
  PageHead,
  Skeleton,
  Table,
  useMask,
} from "./ui";

type ConvertQuote = {
  from: string;
  to: string;
  units: number;
  feeUnits: number;
  receiveUnits: number;
};
const FX: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27 };

export function Accounts() {
  const { verified, state } = useDash();
  const mask = useMask();
  const { pending, run } = useAction();
  const { data, error } = useData<Overview>("demo/overview");
  const incoming = useData<{ rows: Tx[] }>("demo/transactions?type=deposit");
  const outgoing = useData<{ rows: Tx[] }>("demo/transactions?type=transfer");
  const withdrawals = useData<{ rows: Tx[] }>(
    "demo/transactions?type=withdrawal",
  );
  const [reveal, setReveal] = useState(false);
  const [convert, setConvert] = useState({
    from: "USD",
    to: "EUR",
    amount: "",
  });
  const [convertError, setConvertError] = useState("");
  const [quote, setQuote] = useState<ConvertQuote | null>(null);
  const [funds, setFunds] = useState<"deposit" | "withdraw" | null>(null);
  const key = useRef(newKey());

  if (error) return <LoadError message={error} />;
  if (!data) return <Skeleton />;
  const balance = (c: string) =>
    data.holdings.find((h) => h.asset === c)?.quantity ?? 0;
  const amount = Number(convert.amount);
  const estimate =
    amount > 0 && convert.from !== convert.to
      ? ((amount * FX[convert.from]) / FX[convert.to]) * 0.997
      : 0;

  async function request(currency: string) {
    await run(
      () => api(`demo/accounts/${currency}/request`, { method: "POST" }),
      {
        success: `${currency} account requested. It will be ready in about a minute.`,
      },
    );
  }

  async function review() {
    setConvertError("");
    try {
      setQuote(
        await api<ConvertQuote>("demo/convert/quote", { body: convert }),
      );
    } catch (cause) {
      setConvertError(
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  }

  async function confirm() {
    const result = await run(
      () => api("demo/convert", { body: convert, key: key.current }),
      { success: "Conversion complete.", onError: setConvertError },
    );
    setQuote(null);
    if (result) {
      key.current = newKey();
      setConvert({ ...convert, amount: "" });
    }
  }

  const out = [
    ...(outgoing.data?.rows ?? []),
    ...(withdrawals.data?.rows ?? []),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <>
      <PageHead
        title="Global Accounts"
        sub="Hold and manage USD, EUR and GBP."
        action={
          <div className="row">
            <button
              className="btn btn-s btn-sm"
              disabled={!verified}
              onClick={() => setFunds("deposit")}
            >
              Deposit
            </button>
            <button
              className="btn btn-s btn-sm"
              disabled={!verified}
              onClick={() => setFunds("withdraw")}
            >
              Withdraw
            </button>
          </div>
        }
      />
      <Gate />
      <div className="grid g3 mb">
        {data.accounts.map((account) => (
          <div className="card pad acard" key={account.currency}>
            <div className="row sp">
              <b>{account.currency} account</b>
              <Badge status={account.status} />
            </div>
            <div style={{ font: "700 28px var(--fd)" }}>
              {mask(money(balance(account.currency), account.currency))}
            </div>
            <div className="sm mut">Available balance</div>
            {account.status === "active" ? (
              <div className="mt sm">
                <div className="row sp">
                  <span className="mut">Account holder</span>
                  <span>
                    {state?.profile.businessName ?? state?.user.fullName}
                  </span>
                </div>
                <div className="row sp">
                  <span className="mut">
                    {account.currency === "EUR" ? "IBAN" : "Account number"}
                  </span>
                  <span className="num">
                    {reveal
                      ? account.accountNumber
                      : `•••• ${account.accountNumber?.slice(-4)}`}
                  </span>
                </div>
                <div className="row sp">
                  <span className="mut">
                    {account.currency === "EUR"
                      ? "BIC"
                      : account.currency === "GBP"
                        ? "Sort code"
                        : "Routing number"}
                  </span>
                  <span className="num">
                    {reveal ? account.routing : "••••"}
                  </span>
                </div>
                <button
                  className="btn btn-s btn-sm mt"
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? "Hide details" : "Show details"}
                </button>
              </div>
            ) : account.status === "provisioning" ? (
              <p className="sm mt mut">
                Your partner is setting this up. In the preview this takes about
                a minute. We will notify you.
              </p>
            ) : (
              <>
                <p className="sm mt mut">No account yet.</p>
                <button
                  className="btn btn-d btn-sm"
                  disabled={!verified || pending}
                  onClick={() => request(account.currency)}
                >
                  Request {account.currency} account
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid g2 mb">
        <div className="card pad">
          <h3>Convert currency</h3>
          <div className="row" style={{ alignItems: "flex-start" }}>
            {(["from", "to"] as const).map((side) => (
              <div className="grow" key={side}>
                <Field label={side === "from" ? "From" : "To"} id={`c-${side}`}>
                  <select
                    id={`c-${side}`}
                    value={convert[side]}
                    onChange={(e) => {
                      key.current = newKey();
                      setConvert({ ...convert, [side]: e.target.value });
                    }}
                  >
                    {FIAT.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
            ))}
          </div>
          <Field label="Amount" id="c-amt">
            <input
              id="c-amt"
              inputMode="decimal"
              value={convert.amount}
              onChange={(e) => {
                key.current = newKey();
                setConvert({ ...convert, amount: e.target.value });
              }}
            />
          </Field>
          <p className="err-t" role="alert">
            {convertError}
          </p>
          <p className="sm mut">
            {estimate
              ? `You receive about ${money(estimate, convert.to)} after a 0.3% fee.`
              : "Rate and fee appear here."}
          </p>
          <button className="btn btn-d" onClick={review} disabled={!verified}>
            Review conversion
          </button>
        </div>
        <div className="card pad">
          <h3>Limits and fees</h3>
          <Table
            head={["Item", "Value"]}
            rows={[
              ["Incoming payments", "Free"],
              ["Outgoing transfers", "0.4%, minimum 1.00"],
              ["Conversion", "0.3%"],
              ["Single transfer or withdrawal", "5,000 USD"],
              ["Demo deposit", "Up to 50,000 USD each"],
            ]}
          />
          <h3 className="mt">Transfer instructions</h3>
          <p className="sm mut m0">
            To receive money, share the account details above. Details exist
            only after the account is provisioned. In the preview they are
            fictitious and cannot receive real payments.
          </p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card pad">
          <h3>Incoming</h3>
          <Table
            head={["Date", "From", "Amount", "Status"]}
            rows={(incoming.data?.rows ?? [])
              .slice(0, 5)
              .map((t) => [
                date(t.createdAt),
                t.description,
                mask(
                  money(
                    t.amount.value,
                    t.amount.asset in FX ? t.amount.asset : "USD",
                  ),
                ),
                <Badge key="s" status={t.status} />,
              ])}
            empty="No incoming payments yet."
          />
        </div>
        <div className="card pad">
          <h3>Outgoing</h3>
          <Table
            head={["Date", "To", "Amount", "Status"]}
            rows={out.map((t) => [
              date(t.createdAt),
              t.description,
              mask(money(t.amount.value, t.amount.asset)),
              <Badge key="s" status={t.status} />,
            ])}
            empty="No outgoing transfers yet."
          />
        </div>
      </div>

      {funds && <FundsModal kind={funds} onClose={() => setFunds(null)} />}
      {quote && (
        <Modal
          title="Confirm conversion"
          onClose={() => setQuote(null)}
          actions={
            <button className="btn btn-p" onClick={confirm} disabled={pending}>
              {pending ? "Working…" : "Convert"}
            </button>
          }
        >
          <div className="lrow">
            <span>You convert</span>
            <b>{money(quote.units / 1e8, quote.from)}</b>
          </div>
          <div className="lrow">
            <span>You receive</span>
            <b>{money(quote.receiveUnits / 1e8, quote.to)}</b>
          </div>
          <div className="lrow">
            <span>Fee (0.3%)</span>
            <b>{money(quote.feeUnits / 1e8, quote.to)}</b>
          </div>
          <p className="xs mut mt">Illustrative fixed rates. No money moves.</p>
        </Modal>
      )}
    </>
  );
}
