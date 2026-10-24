"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Eye, EyeOff, Menu, PanelLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { api } from "@/lib/api";
import { label } from "@/lib/format";
import { moduleHref, modules } from "@/lib/dashboard-modules";
import { DashboardProvider, useDash, useData } from "./dashboard/context";
import { Badge } from "./dashboard/ui";

const ASSETS = ["Bitcoin", "Ethereum", "Solana", "Tether", "XRP", "Cardano"];
const SYMBOLS: Record<string, string> = {
  Bitcoin: "BTC",
  Ethereum: "ETH",
  Solana: "SOL",
  Tether: "USDT",
  XRP: "XRP",
  Cardano: "ADA",
};

type Note = { id: string; message: string; readAt: string | null };

function Bellmenu({ open }: { open: boolean }) {
  const { data } = useData<Note[]>(open ? "demo/notifications" : null);
  return (
    <div className="pop card">
      <div className="row sp mb">
        <b>Notifications</b>
        <Link href="/dashboard/notifications" className="xs">
          View all
        </Link>
      </div>
      {!data ? (
        <p className="mut sm">Loading…</p>
      ) : data.length ? (
        data.slice(0, 5).map((note) => (
          <div
            key={note.id}
            className="sm"
            style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}
          >
            {note.readAt ? "" : "● "}
            {note.message}
          </div>
        ))
      ) : (
        <p className="mut sm">No notifications.</p>
      )}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { state, hide, setHide } = useDash();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState<"bell" | "profile" | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const business = state?.profile.accountType === "business";

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!top.current?.contains(event.target as Node)) setMenu(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        setMobile(false);
      }
    };
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
    };
  }, []);

  async function logout() {
    await api("auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/sign-in");
    router.refresh();
  }

  function search(value: string) {
    const page = modules.find(
      (item) => item.label.toLowerCase() === value.toLowerCase(),
    );
    if (page) router.push(moduleHref(page.slug));
    else if (SYMBOLS[value])
      router.push(`/dashboard/tradehub?symbol=${SYMBOLS[value]}`);
  }

  const kyc = state?.verification.kyc?.status ?? "not_started";
  const unread = state?.unread ?? 0;

  return (
    <div className={`shell ${collapsed ? "col" : ""} ${mobile ? "mo" : ""}`}>
      <div className="scrim" onClick={() => setMobile(false)} />
      <aside className="side" aria-label="Sidebar">
        <Logo href="/dashboard" size={30} />
        <nav aria-label="Dashboard">
          {modules
            .filter((item) => !("business" in item) || business)
            .map((item) => {
              const href = moduleHref(item.slug);
              const current =
                item.slug === "overview"
                  ? path === href
                  : path.startsWith(href);
              return (
                <Link
                  key={item.slug}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  title={item.label}
                  onClick={() => setMobile(false)}
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span className="lb">
                    {item.label}
                    {item.slug === "notifications" && unread
                      ? ` (${unread})`
                      : ""}
                  </span>
                </Link>
              );
            })}
        </nav>
      </aside>
      <div>
        <div className="top" ref={top}>
          <button
            className="btn btn-s btn-sm mnav"
            onClick={() => setMobile(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <button
            className="btn btn-s btn-sm dnav"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft size={18} />
          </button>
          <input
            list="global-search"
            placeholder="Search pages and assets"
            aria-label="Search pages and assets"
            className="hide-m"
            style={{ maxWidth: 240 }}
            onChange={(event) => search(event.target.value)}
          />
          <datalist id="global-search">
            {modules.map((item) => (
              <option key={item.slug} value={item.label} />
            ))}
            {ASSETS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="grow" />
          <span className="hide-m">
            <Badge
              tone={state?.profile.mfaEnabled ? "b-ok" : "b-warn"}
              text={
                state?.profile.mfaEnabled
                  ? "Security: MFA on"
                  : "Security: MFA off"
              }
            />
          </span>
          <button
            className="btn btn-s btn-sm"
            onClick={() => setHide(!hide)}
            aria-pressed={hide}
            aria-label={hide ? "Show balances" : "Hide balances"}
          >
            {hide ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <div className="menu">
            <button
              className="btn btn-s btn-sm"
              onClick={() => setMenu(menu === "bell" ? null : "bell")}
              aria-label={`Notifications, ${unread} unread`}
              aria-expanded={menu === "bell"}
            >
              <Bell size={18} />
              {unread ? ` ${unread}` : ""}
            </button>
            {menu === "bell" && <Bellmenu open />}
          </div>
          <div className="menu">
            <button
              className="btn btn-d btn-sm"
              onClick={() => setMenu(menu === "profile" ? null : "profile")}
              aria-expanded={menu === "profile"}
            >
              {state?.user.fullName.split(" ")[0] ?? "Account"} ▾
            </button>
            {menu === "profile" && state && (
              <div className="pop card">
                <b>{state.user.fullName}</b>
                <div className="xs mut">{state.user.email}</div>
                <div className="row mt" style={{ gap: 6 }}>
                  <Badge status={kyc} text={`KYC: ${label(kyc)}`} />
                  {business && (
                    <Badge
                      status={state.verification.kyb?.status ?? "not_started"}
                      text={`KYB: ${label(state.verification.kyb?.status ?? "not_started")}`}
                    />
                  )}
                  <Badge
                    tone="b-info"
                    text={business ? "Business" : "Personal"}
                  />
                </div>
                <div className="row mt">
                  <Link className="btn btn-s btn-sm" href="/dashboard/settings">
                    Settings
                  </Link>
                  <button className="btn btn-s btn-sm" onClick={logout}>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <main className="main" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <Frame>{children}</Frame>
    </DashboardProvider>
  );
}
