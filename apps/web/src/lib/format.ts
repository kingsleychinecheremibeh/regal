export const FIAT = ["USD", "EUR", "GBP"] as const;

export function money(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Format an amount of any asset: fiat as currency, others as a quantity. */
export function amount(value: number, asset: string) {
  return (FIAT as readonly string[]).includes(asset)
    ? money(value, asset)
    : `${qty(value)} ${asset}`;
}

export const qty = (value: number, digits = 8) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });

export const date = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const TYPE_LABEL: Record<string, string> = {
  buy: "Buy",
  sell: "Sell",
  swap: "Swap",
  transfer: "Transfer",
  bill: "Bill payment",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  convert: "Conversion",
  card_spend: "Card spend",
  invest: "Investment",
};

export const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_review: "In Review",
  action_required: "Action Required",
  rejected: "Rejected",
  verified: "Verified",
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
  reversed: "Reversed",
  open: "Open",
  cancelled: "Cancelled",
  closed: "Closed",
  active: "Active",
  provisioning: "Provisioning",
  none: "None",
  settled: "Settled",
};

export const label = (status: string) =>
  STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
