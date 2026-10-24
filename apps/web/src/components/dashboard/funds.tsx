"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api, newKey } from "@/lib/api";
import { FIAT } from "@/lib/format";
import { useAction } from "./context";
import { Field, Modal } from "./ui";

/** Deposit, withdraw and receive flows shared by Overview and Accounts. */
export function FundsModal({
  kind,
  onClose,
}: {
  kind: "deposit" | "withdraw" | "receive";
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    currency: "USD",
    amount: "",
    method: "bank",
  });
  const key = useRef(newKey());

  if (kind === "receive")
    return (
      <Modal
        title="Receive money"
        onClose={onClose}
        actions={
          <Link
            className="btn btn-d"
            href="/dashboard/accounts"
            onClick={onClose}
          >
            Open Global Accounts
          </Link>
        }
      >
        <p>
          Share your account details so the sender can pay you. You will find
          them under Global Accounts. In the preview the details are fictitious
          and cannot receive real money.
        </p>
      </Modal>
    );

  const deposit = kind === "deposit";
  const update = (patch: Partial<typeof form>) => {
    key.current = newKey();
    setForm({ ...form, ...patch });
  };
  async function submit() {
    setError("");
    if (!(Number(form.amount) > 0))
      return setError("Enter an amount greater than 0.");
    const result = await run(
      () =>
        api(deposit ? "demo/deposits" : "demo/withdrawals", {
          body: deposit
            ? form
            : { currency: form.currency, amount: form.amount },
          key: key.current,
        }),
      {
        success: deposit
          ? "Deposit started. It is credited when the simulated provider confirms it."
          : "Withdrawal submitted. Status: Pending.",
        onError: setError,
      },
    );
    if (result) onClose();
  }

  return (
    <Modal
      title={deposit ? "Deposit" : "Withdraw"}
      onClose={onClose}
      actions={
        <button className="btn btn-p" onClick={submit} disabled={pending}>
          {pending ? "Working…" : "Continue"}
        </button>
      }
    >
      {deposit && (
        <Field label="Method" id="f-method">
          <select
            id="f-method"
            value={form.method}
            onChange={(e) => update({ method: e.target.value })}
          >
            <option value="bank">Bank transfer</option>
            <option value="card">Card</option>
          </select>
        </Field>
      )}
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <Field label="Amount" id="f-amount">
            <input
              id="f-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => update({ amount: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Currency" id="f-ccy">
          <select
            id="f-ccy"
            value={form.currency}
            onChange={(e) => update({ currency: e.target.value })}
          >
            {FIAT.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="err-t" role="alert">
        {error}
      </p>
      <p className="xs mut">
        {deposit
          ? "Simulated: no money is collected. Funds are credited after about 10 seconds."
          : "Checked against your balance and the 5,000 USD limit. No money leaves the platform."}
      </p>
    </Modal>
  );
}
