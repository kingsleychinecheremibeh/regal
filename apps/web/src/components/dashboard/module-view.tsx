"use client";

import { Suspense } from "react";
import { Accounts } from "./accounts";
import { Acquiring } from "./acquiring";
import { Cards } from "./cards";
import { Overview } from "./overview";
import { Pay } from "./pay";
import {
  Help,
  Notifications,
  Referrals,
  Statements,
  Transactions,
} from "./records";
import { Settings } from "./settings";
import { TradeHub } from "./tradehub";
import { Skeleton } from "./ui";
import { Wealth } from "./wealth";

const VIEWS: Record<string, () => React.ReactNode> = {
  overview: Overview,
  tradehub: TradeHub,
  turboxpay: Pay,
  acquiring: Acquiring,
  accounts: Accounts,
  cards: Cards,
  wealth: Wealth,
  transactions: Transactions,
  statements: Statements,
  notifications: Notifications,
  referrals: Referrals,
  help: Help,
  settings: Settings,
};

export function ModuleView({ module }: { module: string }) {
  const View = VIEWS[module] ?? Overview;
  return (
    <Suspense fallback={<Skeleton />}>
      <View />
    </Suspense>
  );
}
