export const products = [
  {
    id: "tradehub",
    name: "TradeHUB",
    status: "planned",
    description: "Buy, sell and swap supported digital assets.",
    capabilities: ["Market and limit orders", "Swaps", "Watchlists"],
  },
  {
    id: "turboxpay",
    name: "TurboXPay",
    status: "planned",
    description: "Send money and pay bills with costs shown first.",
    capabilities: [
      "Saved beneficiaries",
      "International transfers",
      "Bills and utilities",
    ],
  },
  {
    id: "global-accounts-cards",
    name: "Global Accounts and Virtual Cards",
    status: "planned",
    description: "Hold USD, EUR and GBP and spend online.",
    capabilities: [
      "Multi-currency accounts",
      "Currency conversion",
      "Virtual cards with controls",
    ],
  },
  {
    id: "wealth",
    name: "Wealth",
    status: "planned",
    description: "Invest with disclosures shown before you commit.",
    capabilities: ["Stocks and ETFs", "Real estate", "Portfolio tracking"],
  },
  {
    id: "fiat-acquiring",
    name: "Fiat Acquiring",
    status: "planned",
    description: "Accept payments for verified businesses.",
    capabilities: [
      "Payment links",
      "API keys and webhooks",
      "Settlement reports",
    ],
  },
] as const;
