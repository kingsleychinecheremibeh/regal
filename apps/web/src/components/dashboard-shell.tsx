"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, LogOut, X } from "lucide-react";
import { modules } from "@/lib/dashboard-modules";

export function DashboardShell({
  user,
  children,
}: {
  user: { id: string; fullName: string; email: string };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  }
  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar ${open ? "open" : ""}`}>
        <div className="dash-side-head">
          <Link
            href="/dashboard"
            className="dash-brand"
            onClick={() => setOpen(false)}
          >
            R
            <span>
              REGALVEST <small>2.0</small>
            </span>
          </Link>
          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <p className="sidebar-caption">YOUR WORKSPACE</p>
        <nav aria-label="Dashboard navigation">
          {modules.map((item) => {
            const href =
              item.slug === "overview"
                ? "/dashboard"
                : `/dashboard/${item.slug}`;
            return (
              <Link
                key={item.slug}
                className={`dash-nav-link ${path === href ? "active" : ""}`}
                href={href}
                onClick={() => setOpen(false)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <strong>{user.fullName}</strong>
          <small>{user.email}</small>
          <button onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span>Regalvest investor preview</span>
          <strong className="demo-label">DEMO DATA · NO REAL MONEY</strong>
        </header>
        {children}
      </div>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}
