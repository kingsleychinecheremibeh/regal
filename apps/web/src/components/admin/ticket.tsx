"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/dashboard/ui";
import { dateTime } from "@/lib/format";
import { Notice, useAction, useAdmin, useCan } from "./shared";

type Thread = {
  ticket: {
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
  messages: {
    id: string;
    body: string;
    fromStaff: boolean;
    createdAt: string;
    author: string | null;
  }[];
};

export function AdminTicket({ id }: { id: string }) {
  const { data, error, reload } = useAdmin<Thread>(`admin/tickets/${id}`);
  const { busy, notice, run } = useAction(reload);
  const can = useCan();
  const [reply, setReply] = useState("");

  const back = (
    <Link href="/admin/support" className="adm-back">
      <ArrowLeft size={15} aria-hidden="true" /> All tickets
    </Link>
  );
  if (error)
    return (
      <>
        {back}
        <p className="err-t">{error}</p>
      </>
    );
  if (!data)
    return (
      <>
        {back}
        <p className="mut">Loading…</p>
      </>
    );
  const { ticket, messages } = data;
  const send = async (resolve: boolean) => {
    if (
      await run("reply", `admin/tickets/${id}/reply`, { body: reply, resolve })
    )
      setReply("");
  };

  return (
    <>
      {back}
      <div className="adm-head">
        <div>
          <h1>
            #{ticket.number} · {ticket.subject}
          </h1>
          <p className="mut m0">
            From{" "}
            <Link href={`/admin/users/${ticket.userId}`}>
              {ticket.fullName}
            </Link>{" "}
            ({ticket.email}) · opened {dateTime(ticket.createdAt)}
          </p>
        </div>
        <Badge status={ticket.status} />
      </div>
      <Notice notice={notice} />
      <section className="card pad adm-thread">
        <div className="adm-msgbox customer">
          <div className="xs mut">
            {ticket.fullName} · {dateTime(ticket.createdAt)}
          </div>
          <p>{ticket.body}</p>
        </div>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`adm-msgbox ${m.fromStaff ? "staff" : "customer"}`}
          >
            <div className="xs mut">
              {m.fromStaff
                ? `${m.author ?? "Support"} (TurboXGlobal support)`
                : ticket.fullName}{" "}
              · {dateTime(m.createdAt)}
            </div>
            <p>{m.body}</p>
          </div>
        ))}
      </section>
      {can("support") ? (
        <section className="card pad mt">
          <label className="adm-field">
            Reply to {ticket.fullName.split(" ")[0]}
            <textarea
              rows={4}
              maxLength={4000}
              value={reply}
              placeholder="Your reply appears in the customer's Help and Support page."
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <div className="row mt">
            <button
              className="btn btn-p btn-sm"
              disabled={!!busy || reply.trim().length < 2}
              onClick={() => send(false)}
            >
              Send reply
            </button>
            <button
              className="btn btn-s btn-sm"
              disabled={!!busy || reply.trim().length < 2}
              onClick={() => send(true)}
            >
              Send and resolve
            </button>
          </div>
        </section>
      ) : (
        <p className="xs mut mt">Your role can read tickets but not reply.</p>
      )}
    </>
  );
}
