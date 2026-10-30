"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { nav } from "@/lib/site-content";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setMenu(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <header className="site" ref={ref}>
      <div className="wrap">
        <Logo />
        <button
          className="burger"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
        <nav
          className={`nav ${open ? "open" : ""}`}
          aria-label="Main"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) {
              setOpen(false);
              setMenu(null);
            }
          }}
        >
          {nav.map(([name, groups]) => (
            <div
              className={`nav-item ${groups.length === 1 ? "compact" : ""}`}
              key={name}
            >
              <button
                onClick={() => setMenu(menu === name ? null : name)}
                aria-expanded={menu === name}
              >
                {name} ▾
              </button>
              {menu === name && groups.length === 1 && (
                <div className="drop">
                  {groups[0][1].map(([slug, label]) => (
                    <Link key={slug} href={`/${slug}`}>
                      {label}
                    </Link>
                  ))}
                </div>
              )}
              {menu === name && groups.length > 1 && (
                <div className="mega">
                  <div className="mega-in">
                    {groups.map(([group, items]) => (
                      <div key={group}>
                        <h4>{group}</h4>
                        {items.map(([slug, label]) => (
                          <Link key={slug} href={`/${slug}`}>
                            {label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="nav-item">
            <Link href="/learn">Learn</Link>
          </div>
          <div className="nav-item">
            <Link href="/business">Business</Link>
          </div>
          <div className="nav-item">
            <Link href="/developers">Developers</Link>
          </div>
          <div className="macts">
            <Link className="btn btn-w btn-sm" href="/sign-in">
              Sign In
            </Link>
            <Link className="btn btn-p btn-sm" href="/sign-up">
              Get Started
            </Link>
          </div>
        </nav>
        <div className="acts">
          <Link className="btn btn-w btn-sm" href="/sign-in">
            Sign In
          </Link>
          <Link className="btn btn-p btn-sm" href="/sign-up">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
