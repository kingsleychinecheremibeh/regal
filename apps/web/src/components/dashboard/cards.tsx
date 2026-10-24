"use client";

import { useEffect, useRef, useState } from "react";
import { api, newKey } from "@/lib/api";
import { money } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { Bar } from "./charts";
import { useAction, useDash, useData } from "./context";
import { TxTable } from "./tx";
import {
  Badge,
  Empty,
  Field,
  Gate,
  Modal,
  PageHead,
  Skeleton,
  useMask,
} from "./ui";

type Card = {
  id: string;
  label: string;
  last4: string;
  frozen: boolean;
  limitCents: number;
  spentCents: number;
};
type Revealed = { pan: string; expiry: string; cvv: string };

function CardPanel({ card }: { card: Card }) {
  const { state } = useDash();
  const mask = useMask();
  const { pending, run } = useAction();
  const [limit, setLimit] = useState(String(card.limitCents / 100));
  const [limitError, setLimitError] = useState("");
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [details, setDetails] = useState<Revealed | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!details) return;
    const timer = setTimeout(() => setDetails(null), 30000);
    return () => clearTimeout(timer);
  }, [details]);

  async function reveal() {
    setCodeError("");
    if (!/^\d{6}$/.test(code)) return setCodeError("Enter the 6-digit code.");
    const result = await run(
      () => api<Revealed>(`demo/cards/${card.id}/reveal`, { body: { code } }),
      { onError: setCodeError },
    );
    if (result) {
      setDetails(result);
      setAsking(false);
      setCode("");
    }
  }

  async function saveLimit() {
    setLimitError("");
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 1 || value > 5000)
      return setLimitError("Enter a whole number from 1 to 5,000.");
    await run(
      () =>
        api(`demo/cards/${card.id}`, {
          method: "PATCH",
          body: { limitUsd: value },
        }),
      { success: "Limit saved.", onError: setLimitError },
    );
  }

  return (
    <div className="grid g2 mb">
      <div>
        <div className={`pcard ${card.frozen ? "fz" : ""}`}>
          <div className="row sp" style={{ position: "relative", zIndex: 1 }}>
            <b>{card.label}</b>
            <Badge
              tone={card.frozen ? "b-err" : "b-gold"}
              text={card.frozen ? "Frozen" : "Active"}
            />
          </div>
          <div>
            <div style={{ font: "600 19px var(--fb)", letterSpacing: ".14em" }}>
              {details ? details.pan : `•••• •••• •••• ${card.last4}`}
            </div>
            <div className="sm" style={{ color: "var(--on-navy)" }}>
              {state?.user.fullName} ·{" "}
              {details
                ? `${details.expiry} · CVV ${details.cvv}`
                : "expiry hidden"}
            </div>
          </div>
        </div>
        <div className="row mt">
          <button
            className="btn btn-d btn-sm"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  api(`demo/cards/${card.id}`, {
                    method: "PATCH",
                    body: { frozen: !card.frozen },
                  }),
                {
                  success: card.frozen
                    ? "Card unfrozen."
                    : "Card frozen. New spending is blocked.",
                },
              )
            }
          >
            {card.frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button
            className="btn btn-s btn-sm"
            onClick={() => (details ? setDetails(null) : setAsking(true))}
          >
            {details ? "Hide details" : "Reveal details"}
          </button>
          <button
            className="btn btn-s btn-sm"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  api<{ status: string; reason: string | null }>(
                    `demo/cards/${card.id}/purchase`,
                    { method: "POST", key: newKey() },
                  ),
                {
                  success: (r) =>
                    r.status === "failed"
                      ? (r.reason ?? "Purchase declined.")
                      : "Purchase approved.",
                },
              )
            }
          >
            Simulate a purchase
          </button>
          <button
            className="btn btn-s btn-sm"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel card
          </button>
        </div>
        <p className="xs mut">
          Reveal needs a fresh MFA code (any 6 digits in the preview). Details
          auto-hide after 30 seconds. The number is fictitious and cannot be
          used for payments.
        </p>
      </div>
      <div className="card pad">
        <h3>Spending limit</h3>
        <Field label="Monthly limit (USD)" id={`lim-${card.id}`}>
          <input
            id={`lim-${card.id}`}
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
        <p className="err-t" role="alert">
          {limitError}
        </p>
        <button
          className="btn btn-d btn-sm"
          onClick={saveLimit}
          disabled={pending}
        >
          Save limit
        </button>
        <div className="mt">
          <div className="row sp sm">
            <span>Spent this month</span>
            <span>
              {mask(money(card.spentCents / 100))} of{" "}
              {money(card.limitCents / 100)}
            </span>
          </div>
          <Bar used={card.spentCents} max={card.limitCents} />
        </div>
      </div>

      {asking && (
        <Modal
          title="Confirm it is you"
          onClose={() => setAsking(false)}
          actions={
            <button className="btn btn-d" onClick={reveal} disabled={pending}>
              Reveal
            </button>
          }
        >
          <p>Enter your 6-digit authenticator code to reveal card details.</p>
          <Field
            label="Code"
            id="rv"
            hint="Investor preview: any 6 digits work."
          >
            <input
              id="rv"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <p className="err-t" role="alert">
            {codeError}
          </p>
        </Modal>
      )}
      {confirmCancel && (
        <Modal
          title="Cancel this card?"
          onClose={() => setConfirmCancel(false)}
          actions={
            <button
              className="btn btn-x"
              onClick={async () => {
                await run(
                  () => api(`demo/cards/${card.id}/cancel`, { method: "POST" }),
                  { success: "Card cancelled." },
                );
                setConfirmCancel(false);
              }}
            >
              Cancel card
            </button>
          }
        >
          <p>The card stops working immediately and cannot be restored.</p>
        </Modal>
      )}
    </div>
  );
}

export function Cards() {
  const { verified } = useDash();
  const { pending, run } = useAction();
  const { data } = useData<Card[]>("demo/cards");
  const history = useData<{ rows: Tx[] }>("demo/transactions?type=card_spend");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Online shopping");
  const [error, setError] = useState("");
  const created = useRef(false);

  if (!data) return <Skeleton />;

  async function create() {
    setError("");
    const result = await run(
      () => api("demo/cards", { body: { label: name } }),
      {
        success: "Virtual card created.",
        onError: setError,
      },
    );
    if (result) {
      created.current = true;
      setCreating(false);
    }
  }

  return (
    <>
      <PageHead
        title="Virtual Cards"
        sub="Create and control cards for online payments."
        action={
          data.length > 0 && data.length < 3 ? (
            <button
              className="btn btn-s btn-sm"
              disabled={!verified}
              onClick={() => setCreating(true)}
            >
              New card
            </button>
          ) : undefined
        }
      />
      <Gate />
      {data.length === 0 ? (
        <div className="card pad">
          <Empty
            title="No card yet"
            action={
              <button
                className="btn btn-p"
                disabled={!verified}
                onClick={() => setCreating(true)}
              >
                Create virtual card
              </button>
            }
          >
            Create a virtual card for online and international purchases.
          </Empty>
        </div>
      ) : (
        data.map((card) => <CardPanel key={card.id} card={card} />)
      )}
      <div className="card pad mt">
        <h3>Card transactions</h3>
        <TxTable
          rows={history.data?.rows ?? []}
          empty="No card transactions yet."
        />
      </div>
      {creating && (
        <Modal
          title="Create virtual card"
          onClose={() => setCreating(false)}
          actions={
            <button className="btn btn-p" onClick={create} disabled={pending}>
              {pending ? "Creating…" : "Create card"}
            </button>
          }
        >
          <Field label="Card name" id="card-name">
            <input
              id="card-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </Field>
          <p className="err-t" role="alert">
            {error}
          </p>
          <p className="xs mut">
            Starts with a 1,500 USD monthly limit, spending from your USD
            balance.
          </p>
        </Modal>
      )}
    </>
  );
}
