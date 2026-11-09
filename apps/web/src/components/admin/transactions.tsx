"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download } from "lucide-react";
import { Badge, Table } from "@/components/dashboard/ui";
import { dateTime, label, money, TYPE_LABEL } from "@/lib/format";
import {
  Head,
  Pager,
  Toolbar,
  useAdmin,
  withQuery,
  type Paged,
} from "./shared";

type Row = {
  id: string;
  type: string;
  status: string;
  description: string;
  reference: string;
  currency: string;
  usdCents: number;
  createdAt: string;
  userId: string;
  email: string;
};

const TYPES = Object.keys(TYPE_LABEL);
const STATUSES = ["completed", "pending", "failed", "reversed"];

export function AdminTransactions() {
  const initial = useSearchParams().get("search") ?? "";
  const [search, setSearch] = useState(initial);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const filters = { search, type, status };
  const { data, error } = useAdmin<Paged<Row>>(
    withQuery("admin/transactions", { ...filters, page }),
  );

  return (
    <>
      <Head
        title="Transactions"
        sub="Every sandbox ledger entry across all accounts. Values are simulated."
        action={
          <a
            className="btn btn-s btn-sm"
            href={`/api/v1/${withQuery("admin/transactions.csv", filters)}`}
          >
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <Toolbar
        placeholder={initial || "Search email, description or reference"}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
      >
        <select
          aria-label="Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t] ?? label(t)}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </Toolbar>
      {error && <p className="err-t">{error}</p>}
      <section className="card pad adm-table">
        {!data ? (
          <p className="mut">Loading…</p>
        ) : (
          <>
            <Table
              head={[
                "Date",
                "Customer",
                "Type",
                "Description",
                "Status",
                "Value",
              ]}
              empty="No transactions match."
              rows={data.rows.map((t) => [
                dateTime(t.createdAt),
                <Link key="u" href={`/admin/users/${t.userId}`}>
                  {t.email}
                </Link>,
                TYPE_LABEL[t.type] ?? label(t.type),
                <span key="d">
                  {t.description}
                  <div className="xs mut">{t.reference}</div>
                </span>,
                <Badge key="s" status={t.status} />,
                money(t.usdCents / 100),
              ])}
            />
            <Pager {...data} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
