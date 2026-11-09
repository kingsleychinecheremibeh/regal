"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  FileClock,
  LayoutDashboard,
  LifeBuoy,
  List,
  LogOut,
  Menu,
  Users,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/dashboard/ui";
import { useAdmin } from "./shared";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  {
    href: "/admin/verifications",
    label: "Verification queue",
    icon: BadgeCheck,
  },
  { href: "/admin/transactions", label: "Transactions", icon: List },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/waitlist", label: "Waitlist", icon: UserPlus },
  { href: "/admin/activity", label: "Activity log", icon: FileClock },
];

export function AdminShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  // Refetched on every page change so the counts stay current.
  const { data } = useAdmin<{
    inReview: number;
    tickets: Record<string, number>;
  }>(`admin/overview?nav=${encodeURIComponent(path)}`);
  const counts: Record<string, number> = {
    "/admin/verifications": data?.inReview ?? 0,
    "/admin/support": data?.tickets.open ?? 0,
  };

  async function signOut() {
    await api("auth/logout", { body: {} }).catch(() => {});
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div className={`shell adm ${mobile ? "mo" : ""}`}>
      <div className="scrim" onClick={() => setMobile(false)} />
      <aside className="side" aria-label="Admin sidebar">
        <Logo href="/admin" size={30} />
        <div className="adm-tag">Admin console</div>
        <nav aria-label="Admin">
          {NAV.map((item) => {
            const current =
              item.href === "/admin"
                ? path === "/admin"
                : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setMobile(false)}
              >
                <item.icon size={18} aria-hidden="true" />
                <span className="lb">{item.label}</span>
                {counts[item.href] > 0 && (
                  <span className="adm-count">{counts[item.href]}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="adm-me">
          <b>{name}</b>
          <span>{email}</span>
          <Link href="/dashboard" onClick={() => setMobile(false)}>
            <ArrowLeft size={15} aria-hidden="true" /> My dashboard
          </Link>
          <button type="button" onClick={signOut}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <div>
        <div className="top">
          <button
            className="btn btn-s btn-sm mnav"
            onClick={() => setMobile(true)}
            aria-label="Open menu"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <b>
            {NAV.find((n) => n.href !== "/admin" && path.startsWith(n.href))
              ?.label ?? "Overview"}
          </b>
          <span style={{ marginLeft: "auto" }}>
            <Badge tone="b-gold" text="Admin" />
          </span>
        </div>
        <main className="main adm-main" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
