import { BadRequestException } from "@nestjs/common";

/** Every quantity is stored as an integer count of 1e-8 of the asset. */
export const UNIT = 100_000_000;

export const FIAT = ["USD", "EUR", "GBP"] as const;
export type Fiat = (typeof FIAT)[number];
export const FX: Record<Fiat, number> = { USD: 1, EUR: 1.08, GBP: 1.27 };

/** Fixed illustrative prices in USD. They are not market quotes. */
export const CRYPTO = [
  { symbol: "BTC", name: "Bitcoin", price: 64820.4, change: 1.8 },
  { symbol: "ETH", name: "Ethereum", price: 3120.75, change: -0.6 },
  { symbol: "SOL", name: "Solana", price: 148.3, change: 3.2 },
  { symbol: "USDT", name: "Tether", price: 1, change: 0 },
  { symbol: "XRP", name: "XRP", price: 0.52, change: -1.1 },
  { symbol: "ADA", name: "Cardano", price: 0.45, change: 0.4 },
] as const;

export const WEALTH = [
  {
    id: "GEQ",
    name: "Global equity ETF",
    category: "ETF",
    price: 50,
    minimumUsd: 50,
    risk: "Medium",
    eligible: true,
  },
  {
    id: "USLC",
    name: "US large-cap stocks",
    category: "Stocks",
    price: 10,
    minimumUsd: 10,
    risk: "High",
    eligible: true,
  },
  {
    id: "RESF",
    name: "Residential real estate fund",
    category: "Real estate",
    price: 500,
    minimumUsd: 500,
    risk: "High",
    eligible: false,
  },
  {
    id: "MMF",
    name: "Money market fund",
    category: "Fund",
    price: 1,
    minimumUsd: 100,
    risk: "Low",
    eligible: true,
  },
] as const;

export const TRADE_FEE = 0.005;
export const CONVERT_FEE = 0.003;
export const TRANSFER_FEE = 0.004;
export const DAILY_TRADE_LIMIT_USD = 10_000;
export const DAILY_TRANSFER_LIMIT_USD = 5_000;
export const SINGLE_TRANSFER_LIMIT_USD = 5_000;
export const DEPOSIT_LIMIT_USD = 50_000;

export const isFiat = (asset: string): asset is Fiat =>
  (FIAT as readonly string[]).includes(asset);
export const isCrypto = (asset: string) =>
  CRYPTO.some((item) => item.symbol === asset);

export function priceUsd(asset: string): number {
  if (isFiat(asset)) return FX[asset];
  const found =
    CRYPTO.find((item) => item.symbol === asset) ??
    WEALTH.find((item) => item.id === asset);
  if (!found) throw new BadRequestException(`Unsupported asset ${asset}`);
  return "price" in found ? found.price : 0;
}

export const decimalsOf = (asset: string) => (isFiat(asset) ? 2 : 8);

/** Parse a positive decimal amount into units without floating point error. */
export function toUnits(value: unknown, decimals: number): number {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d{1,12}(\.\d+)?$/.test(text.trim()))
    throw new BadRequestException("Enter an amount greater than 0.");
  const [whole, fraction = ""] = text.trim().split(".");
  if (fraction.length > decimals)
    throw new BadRequestException(
      `Use at most ${decimals} decimal places for this amount.`,
    );
  const units =
    Number(whole) * UNIT + Number((fraction + "00000000").slice(0, 8));
  if (!Number.isSafeInteger(units) || units <= 0)
    throw new BadRequestException("Enter an amount greater than 0.");
  return units;
}

/** Round units down to an asset's display precision. */
export const floorTo = (units: number, decimals: number) => {
  const step = 10 ** (8 - decimals);
  return Math.floor(units / step) * step;
};

export const usdCentsOf = (asset: string, units: number) =>
  Math.round((units / UNIT) * priceUsd(asset) * 100);

/** Convert units of one asset to the equivalent units of another at fixed prices. */
export const convertUnits = (from: string, to: string, units: number) =>
  floorTo(Math.floor((units * priceUsd(from)) / priceUsd(to)), decimalsOf(to));

export const display = (units: number) => units / UNIT;

function seeded(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text: string) =>
  [...text].reduce((h, c) => ((h << 5) + h + c.charCodeAt(0)) | 0, 5381) >>> 0;

/** A deterministic illustrative series that ends at the fixed price. */
export function series(symbol: string, points: number) {
  const asset = CRYPTO.find((item) => item.symbol === symbol);
  if (!asset) throw new BadRequestException("Unsupported asset");
  const random = seeded(hash(symbol) + points);
  const values: number[] = [];
  let value = 1;
  for (let i = 0; i < points; i++) {
    value *= 1 + (random() - 0.5) * 0.045;
    values.push(value);
  }
  const scale = asset.price / values[points - 1];
  return values.map((v) => Number((v * scale).toFixed(4)));
}

export function orderBook(symbol: string) {
  const asset = CRYPTO.find((item) => item.symbol === symbol);
  if (!asset) throw new BadRequestException("Unsupported asset");
  const random = seeded(hash(symbol));
  const asks: [number, number][] = [];
  const bids: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    asks.push([asset.price * (1 + 0.0004 * (7 - i)), random() * 3 + 0.1]);
    bids.push([asset.price * (1 - 0.0004 * (i + 1)), random() * 3 + 0.1]);
  }
  const trades = Array.from({ length: 10 }, () => ({
    side: random() > 0.5 ? "buy" : "sell",
    price: asset.price * (1 + (random() - 0.5) * 0.002),
    quantity: random() * 0.8,
  }));
  return { asks, bids, trades };
}

export const sampleRandom = (seed: string) => seeded(hash(seed));
