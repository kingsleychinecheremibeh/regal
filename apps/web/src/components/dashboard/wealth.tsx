"use client";

import { useRef, useState } from "react";
import { api, newKey } from "@/lib/api";
import { money, qty } from "@/lib/format";
import type { Markets, Overview, Tx } from "@/lib/types";
import { Donut } from "./charts";
import { useAction, useDash, useData } from "./context";
import { TxTable } from "./tx";
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
  Tabs,
  useMask,
} from "./ui";

const PRODUCTS = [
  {
    id: "GEQ",
    name: "Global equity ETF",
    category: "ETF",
    minimum: 50,
    risk: "Medium",
    eligible: true,
  },
  {
    id: "USLC",
    name: "US large-cap stocks",
    category: "Stocks",
    minimum: 10,
    risk: "High",
    eligible: true,
  },
  {
    id: "RESF",
    name: "Residential real estate fund",
    category: "Real estate",
    minimum: 500,
    risk: "High",
    eligible: false,
  },
  {
    id: "MMF",
    name: "Money market fund",
    category: "Fund",
    minimum: 100,
    risk: "Low",
    eligible: true,
  },
] as const;
type Product = (typeof PRODUCTS)[number];
const TABS = ["Holdings", "Products", "History", "Disclosures"] as const;

function Invest({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const [amount, setAmount] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(newKey());
  async function submit() {
    setError("");
    const result = await run(
      () =>
        api("demo/investments", {
          body: { productId: product.id, amount, acknowledgedRisk: ack },
          key: key.current,
        }),
      { success: "Investment request submitted.", onError: setError },
    );
    if (result) onClose();
  }
  return (
    <Modal
      title={`Invest in ${product.name}`}
      onClose={onClose}
      actions={
        <button
          className="btn btn-p"
          onClick={submit}
          disabled={!ack || pending}
        >
          {pending ? "Working…" : "Confirm investment"}
        </button>
      }
    >
      <div className="notice">
        Investing involves risk, including loss of capital. Read the disclosure
        before you continue.
      </div>
      <Field
        label="Amount (USD)"
        id="i-amt"
        hint={`Minimum ${money(product.minimum)}.`}
      >
        <input
          id="i-amt"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            key.current = newKey();
            setAmount(e.target.value);
          }}
        />
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I have read and understood the risk disclosure
      </label>
      <p className="err-t" role="alert">
        {error}
      </p>
    </Modal>
  );
}

export function Wealth() {
  const { verified } = useDash();
  const mask = useMask();
  const { run } = useAction();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Holdings");
  const [investing, setInvesting] = useState<Product | null>(null);
  const [reading, setReading] = useState<Product | null>(null);
  const overview = useData<Overview>("demo/overview");
  const markets = useData<Markets>("demo/markets");
  const history = useData<{ rows: Tx[] }>("demo/transactions?type=invest");

  if (!overview.data) return <Skeleton />;
  const { holdings, totalUsd } = overview.data;
  const name = (asset: string) =>
    PRODUCTS.find((p) => p.id === asset)?.name ?? asset;

  return (
    <>
      <PageHead
        title="Wealth"
        sub="Portfolio, watchlist and eligible products."
      />
      <Gate />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "Holdings" && (
        <>
          <div className="grid g2">
            <div className="card pad">
              <h3>Portfolio overview</h3>
              <Kpi
                title="Portfolio value"
                value={mask(money(totalUsd))}
                sub="At illustrative prices"
              />
              <div className="mt">
                {holdings.length ? (
                  <Donut
                    items={holdings.map((h) => ({
                      label: name(h.asset),
                      value: h.usd,
                    }))}
                  />
                ) : (
                  <Empty title="No holdings yet">
                    Your holdings appear here.
                  </Empty>
                )}
              </div>
            </div>
            <div className="card pad">
              <h3>Watchlist</h3>
              <Table
                head={["Asset", "Price", ""]}
                rows={(markets.data?.assets ?? []).map((a) => [
                  a.name,
                  money(a.price),
                  <button
                    key="w"
                    className="btn btn-s btn-sm"
                    onClick={() =>
                      run(() =>
                        api(`demo/watchlist/${a.symbol}`, { method: "POST" }),
                      )
                    }
                  >
                    {a.watching ? "★ Watching" : "☆ Watch"}
                  </button>,
                ])}
              />
            </div>
          </div>
          <div className="card pad mt">
            <h3>Holdings</h3>
            <Table
              head={["Asset", "Quantity", "Value", "Type"]}
              rows={holdings.map((h) => [
                name(h.asset),
                mask(qty(h.quantity)),
                mask(money(h.usd)),
                <Badge
                  key="k"
                  tone="b-mut"
                  text={
                    h.kind === "cash"
                      ? "Cash"
                      : h.kind === "digital"
                        ? "Digital asset"
                        : "Investment"
                  }
                />,
              ])}
              empty="No holdings yet."
            />
            <p className="xs mut mt m0">
              Real holdings in your demo account are shown here. Watchlist items
              are not holdings.
            </p>
          </div>
        </>
      )}
      {tab === "Products" && (
        <div className="grid g2">
          {PRODUCTS.map((p) => (
            <div className="card pad" key={p.id}>
              <div className="row sp">
                <h3 className="m0">{p.name}</h3>
                {p.eligible ? (
                  <Badge tone="b-ok" text="Eligible" />
                ) : (
                  <Badge tone="b-mut" text="Not available in your country" />
                )}
              </div>
              <p className="sm mut">
                {p.category} · From {money(p.minimum)} · Risk: {p.risk}
              </p>
              <div className="row">
                <button
                  className="btn btn-d btn-sm"
                  disabled={!verified || !p.eligible}
                  onClick={() => setInvesting(p)}
                >
                  Invest
                </button>
                <button
                  className="btn btn-s btn-sm"
                  onClick={() => setReading(p)}
                >
                  Read disclosure
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "History" && (
        <TxTable
          rows={history.data?.rows ?? []}
          empty="No investments yet. Your investment history appears here."
        />
      )}
      {tab === "Disclosures" && (
        <div className="card pad prose">
          <h3>Risk disclosure</h3>
          <p>
            Investing involves risk, including loss of capital. Past performance
            does not guarantee future results. Digital asset prices can be very
            volatile. Information on this screen is educational and not advice.
            Products shown as Not available cannot be bought in your country.
          </p>
          <p>
            In this investor preview, products, prices and holdings are
            simulated. No security or fund unit is bought.
          </p>
        </div>
      )}
      {investing && (
        <Invest product={investing} onClose={() => setInvesting(null)} />
      )}
      {reading && (
        <Modal
          title={`${reading.name}: disclosure`}
          onClose={() => setReading(null)}
        >
          <p className="mut">
            Category: {reading.category}. Minimum: {money(reading.minimum)}.
            Risk: {reading.risk}. You can lose some or all of your money.
            Returns are not guaranteed. Fees apply. This is not advice.
          </p>
        </Modal>
      )}
    </>
  );
}
