"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Table } from "@/components/dashboard/ui";
import { date } from "@/lib/format";
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
  fullName: string;
  email: string;
  emailVerifiedAt: string | null;
  provisionedAt: string | null;
  isAdmin: boolean;
  suspendedAt: string | null;
  createdAt: string;
  accountType: string | null;
  kyc: string | null;
};

const FILTERS = [
  ["all", "All users"],
  ["in_review", "Waiting for review"],
  ["unverified", "Email not verified"],
  ["suspended", "Suspended"],
  ["admins", "Admins"],
] as const;

export function AccountStatus({
  user,
}: {
  user: Pick<Row, "suspendedAt" | "emailVerifiedAt" | "provisionedAt">;
}) {
  if (user.suspendedAt) return <Badge tone="b-err" text="Suspended" />;
  if (!user.emailVerifiedAt && !user.provisionedAt)
    return <Badge tone="b-warn" text="Email unverified" />;
  return <Badge tone="b-ok" text="Active" />;
}

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { data, error } = useAdmin<Paged<Row>>(
    withQuery("admin/users", { search, filter, page }),
  );

  return (
    <>
      <Head
        title="Users"
        sub="Everyone with a TurboXGlobal account. Open a user to see their profile and take action."
      />
      <Toolbar
        placeholder="Search by name or email"
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
      >
        <select
          aria-label="Filter users"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
        >
          {FILTERS.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
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
              head={["User", "Account", "Status", "Identity", "Joined"]}
              empty="No users match."
              rows={data.rows.map((u) => [
                <Link
                  key="u"
                  href={`/admin/users/${u.id}`}
                  className="adm-user"
                >
                  <b>{u.fullName}</b>
                  <span className="xs mut">{u.email}</span>
                </Link>,
                <span key="a">
                  {u.accountType === "business" ? "Business" : "Personal"}
                  {u.isAdmin && (
                    <>
                      {" "}
                      <Badge tone="b-gold" text="Admin" />
                    </>
                  )}
                </span>,
                <AccountStatus key="s" user={u} />,
                <Badge key="k" status={u.kyc ?? "not_started"} />,
                date(u.createdAt),
              ])}
            />
            <Pager {...data} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
