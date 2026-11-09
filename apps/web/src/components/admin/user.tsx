"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Modal, Table } from "@/components/dashboard/ui";
import { amount, date, dateTime, label, money, TYPE_LABEL } from "@/lib/format";
import { AccountStatus } from "./users";
import { ACTION_LABEL, Notice, useAction, useAdmin } from "./shared";
import { CaseDetails } from "./verifications";

type Detail = {
  user: {
    id: string;
    fullName: string;
    email: string;
    emailVerifiedAt: string | null;
    provisionedAt: string | null;
    isAdmin: boolean;
    suspendedAt: string | null;
    createdAt: string;
  };
  profile: {
    accountType: string;
    businessName: string | null;
    referralCode: string;
    mfaEnabled: boolean;
    fundedAt: string | null;
  } | null;
  holdings: { asset: string; units: number }[];
  ledger: {
    id: string;
    type: string;
    status: string;
    description: string;
    reference: string;
    usdCents: number;
    createdAt: string;
  }[];
  verification: {
    kind: string;
    status: string;
    data: Record<string, unknown>;
    note: string | null;
    submittedAt: string | null;
    decidedAt: string | null;
  }[];
  sessions: { id: string; createdAt: string; expiresAt: string }[];
  tickets: {
    id: string;
    number: number;
    subject: string;
    status: string;
    createdAt: string;
  }[];
  history: {
    id: string;
    action: string;
    detail: string | null;
    createdAt: string;
  }[];
};

export function AdminUser({ id }: { id: string }) {
  const { data, error, reload } = useAdmin<Detail>(`admin/users/${id}`);
  const { busy, notice, run } = useAction(reload);
  const [confirm, setConfirm] = useState<null | "suspend" | "reset">(null);
  const [reason, setReason] = useState("");

  if (error)
    return (
      <>
        <BackLink />
        <p className="err-t">{error}</p>
      </>
    );
  if (!data)
    return (
      <>
        <BackLink />
        <p className="mut">Loading…</p>
      </>
    );
  const { user, profile } = data;
  const act = (action: string, body: unknown = {}) =>
    run(action, `admin/users/${id}/${action}`, body);

  return (
    <>
      <BackLink />
      <div className="adm-profile card pad">
        <div className="adm-avatar" aria-hidden="true">
          {user.fullName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <h1 className="m0">{user.fullName}</h1>
          <p className="mut m0">{user.email}</p>
          <div className="row adm-chips">
            <AccountStatus user={user} />
            {user.isAdmin && <Badge tone="b-gold" text="Admin" />}
            <Badge
              tone="b-info"
              text={
                profile?.accountType === "business" ? "Business" : "Personal"
              }
            />
            <span className="xs mut">Joined {date(user.createdAt)}</span>
          </div>
        </div>
        <div className="adm-actions">
          {user.isAdmin ? (
            <p className="xs mut m0">
              Admin accounts are managed from the server command line.
            </p>
          ) : (
            <>
              {user.suspendedAt ? (
                <button
                  className="btn btn-p btn-sm"
                  disabled={!!busy}
                  onClick={() => act("unsuspend")}
                >
                  Reactivate account
                </button>
              ) : (
                <button
                  className="btn btn-d btn-sm"
                  disabled={!!busy}
                  onClick={() => setConfirm("suspend")}
                >
                  Suspend account
                </button>
              )}
              <button
                className="btn btn-s btn-sm"
                disabled={!!busy || data.sessions.length === 0}
                onClick={() => act("sign-out")}
              >
                Sign out everywhere
              </button>
              <button
                className="btn btn-s btn-sm"
                disabled={!!busy}
                onClick={() => setConfirm("reset")}
              >
                Send password reset
              </button>
            </>
          )}
        </div>
      </div>
      <Notice notice={notice} />

      <div className="grid g2 mt">
        <section className="card pad">
          <h3 className="adm-h3">Account details</h3>
          <dl className="adm-kv">
            <dt>Email</dt>
            <dd>
              {user.emailVerifiedAt
                ? `Verified ${date(user.emailVerifiedAt)}`
                : user.provisionedAt
                  ? "Created by operator"
                  : "Not verified"}
            </dd>
            {profile?.businessName && (
              <>
                <dt>Business</dt>
                <dd>{profile.businessName}</dd>
              </>
            )}
            <dt>Two-step sign-in</dt>
            <dd>{profile?.mfaEnabled ? "On" : "Off"}</dd>
            <dt>Referral code</dt>
            <dd>{profile?.referralCode ?? "—"}</dd>
            <dt>Opening balance</dt>
            <dd>
              {profile?.fundedAt
                ? `Credited ${date(profile.fundedAt)}`
                : "Not yet"}
            </dd>
            <dt>Signed-in devices</dt>
            <dd>{data.sessions.length}</dd>
            {user.suspendedAt && (
              <>
                <dt>Suspended</dt>
                <dd>{dateTime(user.suspendedAt)}</dd>
              </>
            )}
          </dl>
        </section>
        <section className="card pad">
          <h3 className="adm-h3">
            Sandbox balances{" "}
            <span className="xs mut">simulated, no monetary value</span>
          </h3>
          {data.holdings.filter((h) => h.units).length ? (
            <ul className="adm-legend">
              {data.holdings
                .filter((h) => h.units)
                .map((h) => (
                  <li key={h.asset}>
                    <span>{h.asset}</span>
                    <b>{amount(h.units / 1e8, h.asset)}</b>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mut">No balances yet.</p>
          )}
        </section>
      </div>

      <section className="card pad mt">
        <h3 className="adm-h3">Verification</h3>
        {data.verification.filter((v) => v.submittedAt).length ? (
          data.verification
            .filter((v) => v.submittedAt)
            .map((v) => (
              <div key={v.kind} className="adm-case">
                <div className="row sp">
                  <b>
                    {v.kind === "kyc" ? "Identity (KYC)" : "Business (KYB)"}
                  </b>
                  <Badge status={v.status} />
                </div>
                <p className="xs mut">
                  Submitted {v.submittedAt ? dateTime(v.submittedAt) : "—"}
                  {v.decidedAt && ` · decided ${dateTime(v.decidedAt)}`}
                  {v.note && ` · note: ${v.note}`}
                </p>
                <CaseDetails data={v.data} />
                {v.status === "in_review" && (
                  <Link
                    className="btn btn-p btn-sm mt"
                    href="/admin/verifications"
                  >
                    Review in queue
                  </Link>
                )}
              </div>
            ))
        ) : (
          <p className="mut">No verification submitted.</p>
        )}
      </section>

      <section className="card pad mt adm-table">
        <h3 className="adm-h3">Recent sandbox activity</h3>
        <Table
          head={["Date", "Type", "Description", "Status", "Value"]}
          empty="No activity yet."
          rows={data.ledger.map((t) => [
            dateTime(t.createdAt),
            TYPE_LABEL[t.type] ?? label(t.type),
            <span key="d">
              {t.description}
              <div className="xs mut">{t.reference}</div>
            </span>,
            <Badge key="s" status={t.status} />,
            money(t.usdCents / 100),
          ])}
        />
        <Link
          className="btn btn-s btn-sm mt"
          href={`/admin/transactions?search=${encodeURIComponent(user.email)}`}
        >
          All transactions
        </Link>
      </section>

      <div className="grid g2 mt">
        <section className="card pad adm-table">
          <h3 className="adm-h3">Support tickets</h3>
          <Table
            head={["#", "Subject", "Status", "Opened"]}
            empty="No tickets."
            rows={data.tickets.map((t) => [
              t.number,
              t.subject,
              <Badge key="s" status={t.status} />,
              date(t.createdAt),
            ])}
          />
        </section>
        <section className="card pad adm-table">
          <h3 className="adm-h3">Admin history</h3>
          <Table
            head={["When", "Action"]}
            empty="No admin actions on this account."
            rows={data.history.map((h) => [
              dateTime(h.createdAt),
              <span key="a">
                {ACTION_LABEL[h.action] ?? h.action}
                {h.detail && <div className="xs mut">{h.detail}</div>}
              </span>,
            ])}
          />
        </section>
      </div>

      {confirm === "suspend" && (
        <Modal
          title={`Suspend ${user.fullName}?`}
          onClose={() => setConfirm(null)}
          actions={
            <button
              className="btn btn-d"
              disabled={!!busy}
              onClick={async () => {
                if (await act("suspend", reason ? { reason } : {})) {
                  setConfirm(null);
                  setReason("");
                }
              }}
            >
              Suspend
            </button>
          }
        >
          <p>
            They will be signed out immediately and will not be able to sign in
            until you reactivate the account.
          </p>
          <label className="adm-field">
            Reason (kept in the activity log)
            <input
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </Modal>
      )}
      {confirm === "reset" && (
        <Modal
          title="Send a password reset email?"
          onClose={() => setConfirm(null)}
          actions={
            <button
              className="btn btn-p"
              disabled={!!busy}
              onClick={async () => {
                if (await act("password-reset")) setConfirm(null);
              }}
            >
              Send email
            </button>
          }
        >
          <p>
            {user.email} will get a link to choose a new password. Their current
            password keeps working until they use it.
          </p>
        </Modal>
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link href="/admin/users" className="adm-back">
      <ArrowLeft size={15} aria-hidden="true" /> All users
    </Link>
  );
}
