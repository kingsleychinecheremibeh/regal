import {
  Bell,
  CircleHelp,
  CreditCard,
  FileText,
  Gift,
  Globe2,
  House,
  Landmark,
  List,
  Settings,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const modules = [
  { slug: "overview", label: "Overview", icon: House },
  { slug: "tradehub", label: "TradeHUB", icon: TrendingUp },
  { slug: "turboxpay", label: "TurboXPay", icon: Wallet },
  { slug: "acquiring", label: "Fiat Acquiring", icon: Store, business: true },
  { slug: "accounts", label: "Global Accounts", icon: Globe2 },
  { slug: "cards", label: "Virtual Cards", icon: CreditCard },
  { slug: "wealth", label: "Wealth", icon: Landmark },
  { slug: "transactions", label: "Transactions", icon: List },
  { slug: "statements", label: "Statements and Reports", icon: FileText },
  { slug: "notifications", label: "Notifications", icon: Bell },
  { slug: "referrals", label: "Referrals and Rewards", icon: Gift },
  { slug: "help", label: "Help and Support", icon: CircleHelp },
  { slug: "settings", label: "Settings", icon: Settings },
] as const;

export type ModuleSlug = (typeof modules)[number]["slug"];

export const moduleHref = (slug: string) =>
  slug === "overview" ? "/dashboard" : `/dashboard/${slug}`;
