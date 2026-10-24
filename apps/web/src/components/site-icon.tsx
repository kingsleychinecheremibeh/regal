import {
  ArrowLeftRight,
  BookOpen,
  ChartLine,
  Code2,
  CreditCard,
  Globe2,
  House,
  Landmark,
  ShieldCheck,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { IconName } from "@/lib/site-content";

const icons = {
  trade: TrendingUp,
  pay: Wallet,
  globe: Globe2,
  card: CreditCard,
  wealth: Landmark,
  shield: ShieldCheck,
  code: Code2,
  book: BookOpen,
  swap: ArrowLeftRight,
  store: Store,
  home: House,
  chart: ChartLine,
} satisfies Record<IconName, unknown>;

export function SiteIcon({
  name,
  size = 24,
}: {
  name: IconName;
  size?: number;
}) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}
