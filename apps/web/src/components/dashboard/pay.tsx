"use client";

import { useState } from "react";
import { api, newKey } from "@/lib/api";
import { FIAT, money } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { useAction, useDash, useData } from "./context";
import { TxTable } from "./tx";
import { Empty, Field, Gate, Modal, PageHead, Seg, Skeleton } from "./ui";

type Beneficiary = {
  id: string;
  kind: "person" | "biller";
  name: string;
  country: string;
  currency: string;
  accountLast4: string;
};
type Quote = {
  beneficiary: Beneficiary;
  currency: string;
  units: number;
  feeUnits: number;
  rate: number;
  receiveUnits: number;
  overLimit: boolean;
};

function AddBeneficiary({
  kind,
  onClose,
}: {
  kind: "person" | "biller";
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    country: "",
    currency: "USD",
    account: "",
  });
  async function save() {
    setError("");
    const result = await run(
      () => api("demo/beneficiaries", { body: { ...form, kind } }),
      {
        success: "Saved. Account details are masked from now on.",
        onError: setError,
      },
    );
    if (result) onClose();
  }
  return (
    <Modal
      title={kind === "biller" ? "Add biller" : "Add beneficiary"}
      onClose={onClose}
      actions={
        <button className="btn btn-d" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      }
    >
      <Field label="Name" id="b-name">
        <input
          id="b-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={
            kind === "biller" ? "Edinburgh Power Ltd" : "Chidi Okeke"
          }
        />
      </Field>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <Field label="Country" id="b-country">
            <input
              id="b-country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Currency" id="b-ccy">
          <select
            id="b-ccy"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {FIAT.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label={
          kind === "biller"
            ? "Customer or account number"
            : "Account number or IBAN"
        }
        id="b-acct"
        hint="Use made-up details. Only the last 4 characters are stored."
      >
        <input
          id="b-acct"
          value={form.account}
          onChange={(e) => setForm({ ...form, account: e.target.value })}
        />
      </Field>
      <p className="err-t" role="alert">
        {error}
      </p>
    </Modal>
  );
}

export function Pay() {
  const { verified } = useDash();
  const [kind, setKind] = useState<"transfer" | "bill">("transfer");
  const [form, setForm] = useState({
    beneficiaryId: "",
    currency: "USD",
    amount: "",
    reference: "",
  });
  const [error, setError] = useState("");
  const [review, setReview] = useState<Quote | null>(null);
  const [adding, setAdding] = useState<"person" | "biller" | null>(null);
  const [key, setKey] = useState(newKey);
  const { pending, run } = useAction();
  const list = useData<Beneficiary[]>("demo/beneficiaries");
  const transfers = useData<{ rows: Tx[] }>("demo/transactions?type=transfer");
  const bills = useData<{ rows: Tx[] }>("demo/transactions?type=bill");

  if (!list.data) return <Skeleton />;
  const options = list.data.filter((b) =>
    kind === "bill" ? b.kind === "biller" : b.kind === "person",
  );
  const selected =
    options.find((b) => b.id === form.beneficiaryId) ?? options[0];
  const history = [...(transfers.data?.rows ?? []), ...(bills.data?.rows ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  const update = (patch: Partial<typeof form>) => {
    setKey(newKey());
    setError("");
    setForm({ ...form, ...patch });
  };

  const amount = Number(form.amount);
  const fee =
    kind === "bill" ? 1 : Math.max(1, Math.floor(amount * 0.004 * 100) / 100);

  async function openReview() {
    setError("");
    if (!selected) return setError("Add a beneficiary first.");
    if (!(amount > 0)) return setError("Enter an amount greater than 0.");
    try {
      setReview(
        await api<Quote>("demo/payments/quote", {
          body: {
            kind,
            beneficiaryId: selected.id,
            currency: form.currency,
            amount: form.amount,
            ...(form.reference ? { reference: form.reference } : {}),
          },
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    }
  }

  async function send() {
    if (!selected) return;
    await run(
      () =>
        api<{ status?: string; duplicate?: boolean }>("demo/payments", {
          body: {
            kind,
            beneficiaryId: selected.id,
            currency: form.currency,
            amount: form.amount,
            ...(form.reference ? { reference: form.reference } : {}),
          },
          key,
        }),
      {
        success: (r) =>
          r.status === "failed"
            ? "Payment declined: over the single-transfer limit."
            : "Payment submitted. Status: Pending.",
      },
    );
    // The key is kept until the form changes, so sending again is blocked.
    setReview(null);
  }

  async function remove(id: string) {
    await run(() => api(`demo/beneficiaries/${id}`, { method: "DELETE" }), {
      success: "Removed.",
    });
  }

  return (
    <>
      <PageHead title="TurboXPay" sub="Send money and pay bills." />
      <Gate />
      <div className="grid g2">
        <div className="card pad">
          <Seg
            label="Payment type"
            items={[
              ["transfer", "Transfer"],
              ["bill", "Bill payment"],
            ]}
            value={kind}
            onChange={(v) => {
              setKind(v);
              update({ beneficiaryId: "" });
            }}
          />
          {options.length ? (
            <div className="mt">
              <Field
                label={kind === "bill" ? "Biller" : "Beneficiary"}
                id="p-ben"
              >
                <select
                  id="p-ben"
                  value={selected?.id}
                  onChange={(e) => update({ beneficiaryId: e.target.value })}
                >
                  {options.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.currency}, {b.country})
                    </option>
                  ))}
                </select>
              </Field>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div className="grow">
                  <Field label="Amount" id="p-amt">
                    <input
                      id="p-amt"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => update({ amount: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Pay from" id="p-ccy">
                  <select
                    id="p-ccy"
                    value={form.currency}
                    onChange={(e) => update({ currency: e.target.value })}
                  >
                    {FIAT.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Reference (optional)" id="p-ref">
                <input
                  id="p-ref"
                  maxLength={40}
                  value={form.reference}
                  onChange={(e) => update({ reference: e.target.value })}
                />
              </Field>
              <p className="err-t" role="alert">
                {error}
              </p>
              <div className="card pad flat">
                {amount > 0
                  ? `Fee ${money(fee, form.currency)}${
                      selected && selected.currency !== form.currency
                        ? ` · converted to ${selected.currency} on review`
                        : ""
                    }`
                  : "Enter an amount to preview the fee and exchange rate."}
              </div>
              <button
                className="btn btn-p mt"
                onClick={openReview}
                disabled={!verified}
              >
                Review payment
              </button>
              <p className="xs mut mt">
                Idempotency key for this form: <code>{key}</code>. Editing the
                form creates a new key. Re-submitting the same request never
                creates a second payment.
              </p>
            </div>
          ) : (
            <Empty
              title={
                kind === "bill" ? "No billers yet" : "No beneficiaries yet"
              }
              action={
                <button
                  className="btn btn-d"
                  onClick={() =>
                    setAdding(kind === "bill" ? "biller" : "person")
                  }
                >
                  {kind === "bill" ? "Add a biller" : "Add a beneficiary"}
                </button>
              }
            >
              Add someone to pay them.
            </Empty>
          )}
        </div>
        <div className="card pad">
          <div className="row sp">
            <h3 className="m0">Saved recipients</h3>
            <div className="row">
              <button
                className="btn btn-s btn-sm"
                onClick={() => setAdding("person")}
              >
                Add beneficiary
              </button>
              <button
                className="btn btn-s btn-sm"
                onClick={() => setAdding("biller")}
              >
                Add biller
              </button>
            </div>
          </div>
          <div className="mt">
            {list.data.length ? (
              list.data.map((b) => (
                <div className="lrow" key={b.id}>
                  <span>
                    <b>{b.name}</b>
                    <div className="xs mut">
                      {b.kind === "biller" ? "Biller" : "Person"} · {b.currency}{" "}
                      · {b.country} · •••• {b.accountLast4}
                    </div>
                  </span>
                  <button
                    className="btn btn-s btn-sm"
                    onClick={() => remove(b.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="mut">None saved.</p>
            )}
          </div>
        </div>
      </div>
      <div className="card pad mt">
        <h3>Payment history</h3>
        <TxTable rows={history} empty="No payments yet." />
      </div>

      {adding && (
        <AddBeneficiary kind={adding} onClose={() => setAdding(null)} />
      )}
      {review && (
        <Modal
          title="Review payment"
          onClose={() => setReview(null)}
          actions={
            <button className="btn btn-p" onClick={send} disabled={pending}>
              {pending ? "Sending…" : "Send payment"}
            </button>
          }
        >
          <div className="lrow">
            <span>To</span>
            <b>{review.beneficiary.name}</b>
          </div>
          <div className="lrow">
            <span>You pay</span>
            <b>{money(review.units / 1e8, review.currency)}</b>
          </div>
          <div className="lrow">
            <span>Fee</span>
            <b>{money(review.feeUnits / 1e8, review.currency)}</b>
          </div>
          {review.beneficiary.currency !== review.currency && (
            <div className="lrow">
              <span>Rate</span>
              <b>{review.rate.toFixed(4)}</b>
            </div>
          )}
          <div className="lrow">
            <span>Recipient gets</span>
            <b>
              {money(review.receiveUnits / 1e8, review.beneficiary.currency)}
            </b>
          </div>
          {review.overLimit && (
            <div className="notice err mt">
              Over the 5,000 USD single-transfer limit. This will be declined
              and recorded as failed.
            </div>
          )}
          <p className="xs mut mt">
            Idempotency key <code>{key}</code>. Simulated payment: no money
            moves.
          </p>
        </Modal>
      )}
    </>
  );
}
