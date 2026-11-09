"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Table } from "@/components/dashboard/ui";
import { dateTime, label } from "@/lib/format";
import {
  Head,
  Notice,
  Pager,
  Toolbar,
  useAction,
  useAdmin,
  useCan,
  withQuery,
  type Paged,
} from "./shared";

type Ticket = {
  id: string;
  number: number;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  userId: string;
  email: string;
  fullName: string;
};
type Message = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
};

const NEXT: Record<string, [string, string][]> = {
  open: [
    ["pending", "Mark pending"],
    ["resolved", "Resolve"],
  ],
  pending: [
    ["resolved", "Resolve"],
    ["open", "Reopen"],
  ],
  resolved: [["open", "Reopen"]],
};

export function AdminSupport() {
  const [tab, setTab] = useState<"tickets" | "messages">("tickets");
  return (
    <>
      <Head
        title="Support"
        sub="Tickets raised from the dashboard and messages sent through the contact form."
      />
      <div className="seg mb" role="group" aria-label="Show">
        <button
          aria-pressed={tab === "tickets"}
          onClick={() => setTab("tickets")}
        >
          Support tickets
        </button>
        <button
          aria-pressed={tab === "messages"}
          onClick={() => setTab("messages")}
        >
          Contact messages
        </button>
      </div>
      {tab === "tickets" ? <Tickets /> : <Messages />}
    </>
  );
}

function Tickets() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAdmin<Paged<Ticket>>(
    withQuery("admin/tickets", { status, page }),
  );
  const { busy, notice, run } = useAction(reload);
  const can = useCan();
  return (
    <>
      <div className="seg mb" role="group" aria-label="Ticket status">
        {[
          ["open", "Open"],
          ["pending", "Pending"],
          ["resolved", "Resolved"],
          ["", "All"],
        ].map(([key, text]) => (
          <button
            key={key}
            aria-pressed={status === key}
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
          >
            {text}
          </button>
        ))}
      </div>
      <Notice notice={notice} />
      {error && <p className="err-t">{error}</p>}
      <section className="card pad adm-table">
        {!data ? (
          <p className="mut">Loading…</p>
        ) : (
          <>
            <Table
              head={["#", "Customer", "Request", "Status", "Opened", ""]}
              empty="No tickets here."
              rows={data.rows.map((t) => [
                t.number,
                <Link
                  key="u"
                  href={`/admin/users/${t.userId}`}
                  className="adm-user"
                >
                  <b>{t.fullName}</b>
                  <span className="xs mut">{t.email}</span>
                </Link>,
                <Link
                  key="r"
                  href={`/admin/support/${t.id}`}
                  className="adm-msg adm-user"
                >
                  <b>{t.subject}</b>
                  <span>{t.body}</span>
                </Link>,
                <Badge key="s" status={t.status} />,
                dateTime(t.createdAt),
                <div key="a" className="row">
                  <Link
                    className="btn btn-s btn-sm"
                    href={`/admin/support/${t.id}`}
                  >
                    Open
                  </Link>
                  {(can("support") ? (NEXT[t.status] ?? []) : []).map(
                    ([to, text]) => (
                      <button
                        key={to}
                        className={`btn btn-sm ${to === "resolved" ? "btn-p" : "btn-s"}`}
                        disabled={!!busy}
                        onClick={() =>
                          run(t.id + to, `admin/tickets/${t.id}/status`, {
                            status: to,
                          })
                        }
                      >
                        {text}
                      </button>
                    ),
                  )}
                </div>,
              ])}
            />
            <Pager {...data} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}

function Messages() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useAdmin<Paged<Message>>(
    withQuery("admin/messages", { search, page }),
  );
  return (
    <>
      <Toolbar
        placeholder="Search name, email or message"
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
              head={["Received", "From", "Topic", "Message"]}
              empty="No messages."
              rows={data.rows.map((m) => [
                dateTime(m.createdAt),
                <span key="f" className="adm-user">
                  <b>{m.name}</b>
                  <a className="xs" href={`mailto:${m.email}`}>
                    {m.email}
                  </a>
                </span>,
                label(m.topic),
                <span key="m" className="adm-msg">
                  <span>{m.message}</span>
                </span>,
              ])}
            />
            <Pager {...data} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
