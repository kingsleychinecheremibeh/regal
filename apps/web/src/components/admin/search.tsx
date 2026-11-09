"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

type Results = {
  users: { id: string; fullName: string; email: string }[];
  transactions: {
    id: string;
    description: string;
    reference: string;
    usdCents: number;
    userId: string;
    email: string;
  }[];
  tickets: { id: string; number: number; subject: string; status: string }[];
};

/** Top-bar search across users, transactions and tickets. */
export function GlobalSearch() {
  const path = usePathname();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = setTimeout(() => {
      api<Results>(`admin/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
    setQ("");
  }

  const empty =
    results &&
    !results.users.length &&
    !results.transactions.length &&
    !results.tickets.length;

  return (
    <div className="adm-search" ref={box}>
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        placeholder="Search users, references, tickets…"
        aria-label="Search the admin console"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length < 2) setOpen(false);
        }}
        onFocus={() => results && q.trim().length >= 2 && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      {open && results && (
        <div className="adm-search-pop" role="listbox">
          {empty && <p className="mut xs m0">No matches for “{q}”.</p>}
          {!!results.users.length && <h4>Users</h4>}
          {results.users.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`}>
              <b>{u.fullName}</b>
              <span>{u.email}</span>
            </Link>
          ))}
          {!!results.transactions.length && <h4>Transactions</h4>}
          {results.transactions.map((t) => (
            <Link key={t.id} href={`/admin/users/${t.userId}`}>
              <b>
                {t.reference} · {money(t.usdCents / 100)}
              </b>
              <span>
                {t.description} · {t.email}
              </span>
            </Link>
          ))}
          {!!results.tickets.length && <h4>Tickets</h4>}
          {results.tickets.map((t) => (
            <Link key={t.id} href={`/admin/support/${t.id}`}>
              <b>
                #{t.number} {t.subject}
              </b>
              <span>{t.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
