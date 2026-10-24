"use client";

import Link from "next/link";
import { useState } from "react";
import { amount, date, dateTime, label, TYPE_LABEL } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { Badge, Modal, Table, useMask } from "./ui";

const META_LABEL: Record<string, string> = {
  beneficiary: "Beneficiary",
  account: "Account",
  rate: "Exchange rate",
  recipientGets: "Recipient gets",
  reference: "Your reference",
  merchant: "Merchant",
  card: "Card",
};

export function TxDetails({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const line = (title: string, value: React.ReactNode) => (
    <div className="lrow" key={title}>
      <span className="mut">{title}</span>
      <b style={{ textAlign: "right" }}>{value}</b>
    </div>
  );
  return (
    <Modal title="Transaction details" onClose={onClose}>
      {line("Reference", <code>{tx.reference}</code>)}
      {line("Description", tx.description)}
      {line("Type", TYPE_LABEL[tx.type] ?? tx.type)}
      {tx.debit && line("Debited", amount(tx.debit.value, tx.debit.asset))}
      {tx.credit && line("Credited", amount(tx.credit.value, tx.credit.asset))}
      {tx.fee &&
        tx.fee.value > 0 &&
        line("Fee", amount(tx.fee.value, tx.fee.asset))}
      {Object.entries(tx.meta).map(([key, value]) =>
        line(META_LABEL[key] ?? key, value),
      )}
      {line("Simulated provider reference", <code>{tx.providerRef}</code>)}
      {line("Status", <Badge status={tx.status} />)}
      {tx.reason && (
        <div className="notice err mt">
          {tx.reason} <Link href="/dashboard/help">Contact support</Link>
        </div>
      )}
      <div className="tl mt">
        <div>
          <b>Created</b>
          <div className="xs mut">{dateTime(tx.createdAt)}</div>
        </div>
        {tx.status !== "failed" && (
          <div>
            <b>Authorised</b>
          </div>
        )}
        <div
          className={
            tx.status === "failed" ? "x" : tx.status === "pending" ? "p" : ""
          }
        >
          <b>{tx.status === "pending" ? "Processing" : label(tx.status)}</b>
        </div>
      </div>
    </Modal>
  );
}

export function TxTable({
  rows,
  empty = "No transactions yet. Activity will appear here.",
}: {
  rows: Tx[];
  empty?: React.ReactNode;
}) {
  const mask = useMask();
  const [open, setOpen] = useState<Tx | null>(null);
  return (
    <>
      <Table
        head={["Date", "Description", "Type", "Amount", "Status", ""]}
        rows={rows.map((tx) => [
          date(tx.createdAt),
          <span key="d">
            <b>{tx.description}</b>
            <div className="xs mut">{tx.reference}</div>
          </span>,
          TYPE_LABEL[tx.type] ?? tx.type,
          <span key="a" className={`num ${tx.amount.sign > 0 ? "up" : ""}`}>
            {tx.amount.sign < 0 ? "−" : "+"}
            {mask(amount(tx.amount.value, tx.amount.asset))}
          </span>,
          <span key="s">
            <Badge status={tx.status} />
            {tx.reason && <div className="xs dn">{tx.reason}</div>}
          </span>,
          <button
            key="b"
            className="btn btn-s btn-sm"
            onClick={() => setOpen(tx)}
          >
            Details
          </button>,
        ])}
        empty={empty}
      />
      {open && <TxDetails tx={open} onClose={() => setOpen(null)} />}
    </>
  );
}
