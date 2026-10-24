"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { api, newKey } from "@/lib/api";
import { money, qty } from "@/lib/format";
import type { Markets, Overview, Tx } from "@/lib/types";
import { Spark } from "./charts";
import { useAction, useDash, useData } from "./context";
import { TxTable } from "./tx";
import {
  Badge,
  Field,
  Gate,
  LoadError,
  Modal,
  PageHead,
  Seg,
  Skeleton,
  Table,
  Tabs,
  useMask,
} from "./ui";

type Side = "buy" | "sell" | "swap";
const SWAP = ["BTC", "ETH", "SOL", "USDT", "XRP", "ADA"];
const FEE = 0.005;

type TradeQuote =
  | {
      side: "buy" | "sell";
      symbol: string;
      units: number;
      price: number;
      usdCents: number;
      feeCents: number;
      totalCents: number;
    }
  | {
      side: "swap";
      from: string;
      to: string;
      units: number;
      receiveUnits: number;
      feeUnits: number;
    };

export function TradeHub() {
  const params = useSearchParams();
  const { verified } = useDash();
  const mask = useMask();
  const [symbol, setSymbol] = useState(params.get("symbol") ?? "BTC");
  const [points, setPoints] = useState(60);
  const [side, setSide] = useState<Side>(
    (["buy", "sell", "swap"] as const).find((s) => s === params.get("side")) ??
      "buy",
  );
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [limit, setLimit] = useState("");
  const [from, setFrom] = useState("BTC");
  const [to, setTo] = useState("ETH");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"Open orders" | "Trade history">(
    "Open orders",
  );
  const [error, setError] = useState("");
  const [review, setReview] = useState<TradeQuote | null>(null);
  const key = useRef(newKey());
  const { pending, run } = useAction();

  const { data, error: loadError } = useData<Markets>(
    `demo/markets?symbol=${symbol}&points=${points}`,
  );
  const overview = useData<Overview>("demo/overview");
  const history = useData<{ rows: Tx[] }>("demo/transactions?type=buy");
  const swaps = useData<{ rows: Tx[] }>("demo/transactions?type=swap");
  const sells = useData<{ rows: Tx[] }>("demo/transactions?type=sell");

  const held = (asset: string) =>
    overview.data?.holdings.find((h) => h.asset === asset)?.quantity ?? 0;

  type Preview =
    | { kind: "swap"; receive: number; fee: number }
    | { kind: "trade"; notional: number; fee: number; total: number };
  const preview = useMemo((): Preview | null => {
    const amount = Number(quantity);
    if (!data || !(amount > 0)) return null;
    const price = (s: string) =>
      data.assets.find((a) => a.symbol === s)?.price ?? 0;
    if (side === "swap") {
      const gross = (amount * price(from)) / price(to);
      return { kind: "swap", receive: gross * (1 - FEE), fee: gross * FEE };
    }
    const unit =
      type === "limit" && Number(limit) > 0 ? Number(limit) : price(symbol);
    const notional = amount * unit;
    const fee = notional * FEE;
    return {
      kind: "trade",
      notional,
      fee,
      total: side === "buy" ? notional + fee : notional - fee,
    };
  }, [data, quantity, side, from, to, type, limit, symbol]);

  if (loadError) return <LoadError message={loadError} />;
  if (!data) return <Skeleton />;
  const asset = data.selected;
  const up = asset.change >= 0;
  const tradeRows = [
    ...(history.data?.rows ?? []),
    ...(sells.data?.rows ?? []),
    ...(swaps.data?.rows ?? []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const changed = (fn: () => void) => {
    key.current = newKey();
    setError("");
    fn();
  };

  async function openReview() {
    setError("");
    if (!(Number(quantity) > 0))
      return setError("Enter an amount greater than 0.");
    if (side === "swap" && from === to)
      return setError("Choose two different assets.");
    if (type === "limit" && side !== "swap" && !(Number(limit) > 0))
      return setError("Enter a valid limit price.");
    try {
      const quote = await api<TradeQuote>("demo/trades/quote", {
        body:
          side === "swap"
            ? { side, from, to, quantity }
            : { side, symbol, quantity },
      });
      setReview(quote);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    }
  }

  async function confirm() {
    const limitOrder = side !== "swap" && type === "limit";
    const result = await run(
      () =>
        limitOrder
          ? api<{ executed: boolean }>("demo/orders/limit", {
              body: { side, symbol, quantity, limitPrice: Number(limit) },
              key: key.current,
            })
          : api("demo/trades", {
              body:
                side === "swap"
                  ? { side, from, to, quantity }
                  : { side, symbol, quantity },
              key: key.current,
            }),
      {
        success: (r) =>
          limitOrder && !(r as { executed: boolean }).executed
            ? "Limit order placed. Status: Open."
            : "Order submitted. Status: Pending.",
        onError: (message) => {
          setReview(null);
          setError(message);
        },
      },
    );
    if (result) {
      setReview(null);
      setQuantity("");
      key.current = newKey();
    }
  }

  async function watch() {
    await run(() => api(`demo/watchlist/${asset.symbol}`, { method: "POST" }));
  }

  async function cancel(id: string) {
    await run(() => api(`demo/orders/${id}/cancel`, { method: "POST" }), {
      success: "Order cancelled.",
    });
  }

  const visible = data.assets.filter((a) =>
    `${a.name} ${a.symbol}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHead
        title="TradeHUB"
        sub="Buy, sell and swap supported digital assets at illustrative prices."
      />
      <Gate />
      <div className="ticket">
        <div className="card pad" style={{ alignSelf: "start" }}>
          <div className="field">
            <input
              placeholder="Search assets"
              aria-label="Search assets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {visible.map((a) => (
            <button
              key={a.symbol}
              className="arow"
              aria-pressed={a.symbol === symbol}
              onClick={() => changed(() => setSymbol(a.symbol))}
            >
              <span>
                <b>{a.symbol}</b> <span className="xs mut">{a.name}</span>
              </span>
              <span className="sm r">
                {money(a.price)}
                <br />
                <span className={`xs ${a.change >= 0 ? "up" : "dn"}`}>
                  {a.change >= 0 ? "+" : ""}
                  {a.change}%
                </span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="card pad mb">
            <div className="row sp">
              <div>
                <h3 className="m0">
                  {asset.name} <span className="mut">{asset.symbol}/USD</span>
                </h3>
                <div style={{ font: "700 26px var(--fd)" }}>
                  {money(asset.price)}{" "}
                  <span className={`sm ${up ? "up" : "dn"}`}>
                    {up ? "+" : ""}
                    {asset.change}%
                  </span>
                </div>
              </div>
              <div className="row">
                <button className="btn btn-s btn-sm" onClick={watch}>
                  {asset.watching ? "★ Watching" : "☆ Watch"}
                </button>
                <Seg
                  label="Chart range"
                  items={[
                    ["24", "1D"],
                    ["60", "1W"],
                    ["120", "1M"],
                  ]}
                  value={String(points)}
                  onChange={(v) => setPoints(Number(v))}
                />
              </div>
            </div>
            <Spark data={asset.series} up={up} />
            <p className="xs mut m0">{data.asOf}.</p>
          </div>

          <div className="grid g2 mb">
            <div className="card pad">
              <b>Order book</b>
              <div className="ob">
                {asset.asks.map(([price, size], i) => (
                  <div className="a" key={`a${i}`}>
                    <span>{price.toFixed(2)}</span>
                    <span>{size.toFixed(3)}</span>
                  </div>
                ))}
                <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />
                {asset.bids.map(([price, size], i) => (
                  <div className="bd" key={`b${i}`}>
                    <span>{price.toFixed(2)}</span>
                    <span>{size.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card pad">
              <b>Recent trades</b>
              <div className="ob">
                {asset.trades.map((t, i) => (
                  <div className={t.side === "buy" ? "bd" : "a"} key={i}>
                    <span>{t.price.toFixed(2)}</span>
                    <span>{t.quantity.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card pad">
            <Tabs
              items={["Open orders", "Trade history"] as const}
              value={tab}
              onChange={setTab}
            />
            {tab === "Open orders" ? (
              <Table
                head={["Pair", "Side", "Qty", "Limit price", "Status", ""]}
                rows={data.orders
                  .filter((o) => o.status === "open")
                  .map((o) => [
                    `${o.symbol}/USD`,
                    o.side,
                    qty(o.quantity),
                    money(o.limitPrice),
                    <Badge key="s" status="open" />,
                    <button
                      key="c"
                      className="btn btn-s btn-sm"
                      onClick={() => cancel(o.id)}
                    >
                      Cancel
                    </button>,
                  ])}
                empty="No open orders."
              />
            ) : (
              <TxTable rows={tradeRows.slice(0, 10)} empty="No trades yet." />
            )}
          </div>
        </div>

        <div className="card pad" style={{ alignSelf: "start" }}>
          <Seg
            label="Side"
            items={[
              ["buy", "Buy"],
              ["sell", "Sell"],
              ["swap", "Swap"],
            ]}
            value={side}
            onChange={(v) => changed(() => setSide(v))}
          />
          {side === "swap" ? (
            <div className="mt">
              <Field label="From" id="t-from">
                <select
                  id="t-from"
                  value={from}
                  onChange={(e) => changed(() => setFrom(e.target.value))}
                >
                  {SWAP.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="To" id="t-to">
                <select
                  id="t-to"
                  value={to}
                  onChange={(e) => changed(() => setTo(e.target.value))}
                >
                  {SWAP.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <div className="mt">
              <Seg
                label="Order type"
                items={[
                  ["market", "Market"],
                  ["limit", "Limit"],
                ]}
                value={type}
                onChange={(v) => changed(() => setType(v))}
              />
              {type === "limit" && (
                <div className="mt">
                  <Field label="Limit price (USD)" id="t-limit">
                    <input
                      id="t-limit"
                      inputMode="decimal"
                      placeholder={String(asset.price)}
                      value={limit}
                      onChange={(e) => changed(() => setLimit(e.target.value))}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
          <div className="mt">
            <Field
              label={`Amount (${side === "swap" ? from : asset.symbol})`}
              id="t-qty"
            >
              <input
                id="t-qty"
                inputMode="decimal"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => changed(() => setQuantity(e.target.value))}
              />
            </Field>
          </div>
          <p className="err-t" role="alert">
            {error}
          </p>
          <div className="card pad flat">
            {!preview ? (
              "Enter an amount to see the fee and total."
            ) : preview.kind === "swap" ? (
              <>
                <div className="row sp">
                  <span>You receive about</span>
                  <b>
                    {qty(preview.receive, 6)} {to}
                  </b>
                </div>
                <div className="row sp sm mut">
                  <span>Fee (0.5%)</span>
                  <span>
                    {qty(preview.fee, 6)} {to}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="row sp">
                  <span>Notional</span>
                  <b>{money(preview.notional)}</b>
                </div>
                <div className="row sp sm mut">
                  <span>Fee (0.5%)</span>
                  <span>{money(preview.fee)}</span>
                </div>
                <div className="row sp">
                  <span>{side === "buy" ? "Total cost" : "You receive"}</span>
                  <b>{money(preview.total)}</b>
                </div>
              </>
            )}
          </div>
          <div className="sm mut mt">
            Available:{" "}
            {side === "buy"
              ? mask(money(held("USD")))
              : side === "sell"
                ? mask(`${qty(held(asset.symbol))} ${asset.symbol}`)
                : mask(`${qty(held(from))} ${from}`)}
          </div>
          <button
            className="btn btn-p btn-block mt"
            onClick={openReview}
            disabled={!verified}
          >
            Preview order
          </button>
          <p className="xs mut mt">
            Prices are fixed for the preview. A live platform would re-quote
            before you confirm.
          </p>
        </div>
      </div>

      {review && (
        <Modal
          title={`Confirm ${side !== "swap" && type === "limit" ? "limit " : ""}${side}`}
          onClose={() => setReview(null)}
          actions={
            <button className="btn btn-p" onClick={confirm} disabled={pending}>
              {pending ? "Working…" : "Confirm order"}
            </button>
          }
        >
          {review.side === "swap" ? (
            <>
              <div className="lrow">
                <span>You swap</span>
                <b>
                  {qty(review.units / 1e8)} {review.from}
                </b>
              </div>
              <div className="lrow">
                <span>You receive</span>
                <b>
                  {qty(review.receiveUnits / 1e8)} {review.to}
                </b>
              </div>
              <div className="lrow">
                <span>Fee (0.5%)</span>
                <b>
                  {qty(review.feeUnits / 1e8)} {review.to}
                </b>
              </div>
            </>
          ) : (
            <>
              <div className="lrow">
                <span>Quantity</span>
                <b>
                  {qty(review.units / 1e8)} {review.symbol}
                </b>
              </div>
              <div className="lrow">
                <span>{type === "limit" ? "Limit price" : "Price"}</span>
                <b>{money(type === "limit" ? Number(limit) : review.price)}</b>
              </div>
              {type === "market" && (
                <>
                  <div className="lrow">
                    <span>Fee (0.5%)</span>
                    <b>{money(review.feeCents / 100)}</b>
                  </div>
                  <div className="lrow">
                    <span>
                      {review.side === "buy" ? "Total cost" : "You receive"}
                    </span>
                    <b>{money(review.totalCents / 100)}</b>
                  </div>
                </>
              )}
              {type === "limit" && (
                <p className="sm mut mt">
                  If your limit already crosses the current price, the order
                  fills immediately at the current price. Otherwise it stays
                  open.
                </p>
              )}
            </>
          )}
          <p className="xs mut mt">
            Simulated order. No asset is bought or sold.
          </p>
        </Modal>
      )}
    </>
  );
}
