"use client";

import Link from "next/link";
import { useState } from "react";
import { Table } from "@/components/dashboard/ui";
import { dateTime } from "@/lib/format";
import {
  ACTION_LABEL,
  Head,
  Pager,
  useAdmin,
  withQuery,
  type Paged,
} from "./shared";

type Row = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  adminEmail: string | null;
  targetId: string | null;
  targetEmail: string | null;
};

export function AdminActivity() {
  const [page, setPage] = useState(1);
  const { data, error } = useAdmin<Paged<Row>>(
    withQuery("admin/audit", { page }),
  );
  return (
    <>
      <Head
        title="Activity log"
        sub="Every action taken in the admin console: who did it, to whom and when."
      />
      {error && <p className="err-t">{error}</p>}
      <section className="card pad adm-table">
        {!data ? (
          <p className="mut">Loading…</p>
        ) : (
          <>
            <Table
              head={["When", "Admin", "Action", "Account"]}
              empty="No admin actions yet."
              rows={data.rows.map((r) => [
                dateTime(r.createdAt),
                r.adminEmail ?? "Deleted account",
                <span key="a">
                  {ACTION_LABEL[r.action] ?? r.action}
                  {r.detail && <div className="xs mut">{r.detail}</div>}
                </span>,
                r.targetId ? (
                  <Link key="t" href={`/admin/users/${r.targetId}`}>
                    {r.targetEmail}
                  </Link>
                ) : (
                  "—"
                ),
              ])}
            />
            <Pager {...data} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
