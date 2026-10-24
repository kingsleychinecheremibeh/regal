export type Money = { asset: string; value: number };

export type Tx = {
  id: string;
  type: string;
  description: string;
  reference: string;
  providerRef: string;
  status: string;
  reason: string | null;
  currency: string;
  usd: number;
  amount: Money & { sign: number };
  debit: Money | null;
  credit: Money | null;
  fee: Money | null;
  meta: Record<string, string>;
  createdAt: string;
};

export type Holding = {
  asset: string;
  quantity: number;
  usd: number;
  kind: "cash" | "digital" | "investment";
};

export type Account = {
  currency: "USD" | "EUR" | "GBP";
  status: "none" | "provisioning" | "active";
  accountNumber: string | null;
  routing: string | null;
};

export type Asset = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  watching: boolean;
};

export type Markets = {
  label: string;
  asOf: string;
  assets: Asset[];
  selected: Asset & {
    series: number[];
    asks: [number, number][];
    bids: [number, number][];
    trades: { side: string; price: number; quantity: number }[];
  };
  orders: {
    id: string;
    symbol: string;
    side: string;
    quantity: number;
    limitPrice: number;
    status: string;
    createdAt: string;
  }[];
};

export type Overview = {
  holdings: Holding[];
  totalUsd: number;
  recent: Tx[];
  watchlist: string[];
  pending: number;
  accounts: Account[];
  limits: Record<"trading" | "transfers", { used: number; max: number }>;
};
