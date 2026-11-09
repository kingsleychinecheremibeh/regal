"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Table } from "@/components/dashboard/ui";
import { dateTime } from "@/lib/format";
import {
  Head,
  Pager,
  Toolbar,
  useAdmin,
  withQuery,
  type Paged,
} from "./shared";

type Row = { id: string; email: string; consentAt: string; createdAt: string };

export function AdminWaitlist() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useAdmin<Paged<Row>>(
    withQuery("admin/waitlist", { search, page }),
  );
  return (
    <>
      <Head
        title="Waitlist"
        sub="People who asked for launch updates, with the time they consented."
        action={
          <a className="btn btn-s btn-sm" href="/api/v1/admin/waitlist.csv">
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <Toolbar
        placeholder="Search by email"
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />
      {error && <p className="err-t">{error}</p>}
      <section className="card pad adm-table">
        {!data ? (
          <p className="mut">Loading…</p>
        ) : (
          <>
            <Table
              head={["Email", "Consented", "Joined"]}
              empty="Nobody on the waitlist yet."
              rows={data.rows.map((r) => [
                <a key="e" href={`mailto:${r.email}`}>
                  {r.email}
                </a>,
                dateTime(r.consentAt),
                dateTime(r.createdAt),
              ])}
            />
            <Pager {...data} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
