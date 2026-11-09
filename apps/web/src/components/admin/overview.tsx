"use client";

import Link from "next/link";
import { Kpi } from "@/components/dashboard/ui";
import { Donut } from "@/components/dashboard/charts";
import { money } from "@/lib/format";
import { Bars, Head, useAdmin } from "./shared";

type Overview = {
  users: {
    total: number;
    lastWeek: number;
    verifiedEmail: number;
    suspended: number;
    admins: number;
    active: number;
  };
  waitlist: number;
  messages: number;
  transactions: { total: number; lastWeek: number };
  verification: Record<string, Record<string, number>>;
  inReview: number;
  tickets: Record<string, number>;
  signups: { day: string; total: number }[];
  volume: { day: string; total: number; usdCents: number }[];
};

const FUNNEL = [
  ["not_started", "Not started"],
  ["in_review", "In review"],
  ["action_required", "Needs info"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
] as const;

export function AdminOverview() {
  const { data: o, error } = useAdmin<Overview>("admin/overview");
  if (error) return <p className="err-t">{error}</p>;
  if (!o)
    return (
      <>
        <Head title="Overview" sub="Loading the latest numbers…" />
        <div className="grid g4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card pad kpi adm-skel" />
          ))}
        </div>
      </>
    );
  const kyc = o.verification.kyc ?? {};
  const openTickets = (o.tickets.open ?? 0) + (o.tickets.pending ?? 0);
  const volume30 = o.volume.reduce((sum, v) => sum + v.usdCents, 0);

  return (
    <>
      <Head
        title="Overview"
        sub="Accounts, verification and sandbox activity across TurboXGlobal."
      />

      {(o.inReview > 0 || openTickets > 0) && (
        <div className="adm-queue">
          {o.inReview > 0 && (
            <Link href="/admin/verifications" className="card pad">
              <b>{o.inReview}</b>
              <span>
                verification{o.inReview === 1 ? "" : "s"} waiting for review
              </span>
              <em>Review now →</em>
            </Link>
          )}
          {openTickets > 0 && (
            <Link href="/admin/support" className="card pad">
              <b>{openTickets}</b>
              <span>open support ticket{openTickets === 1 ? "" : "s"}</span>
              <em>Open support →</em>
            </Link>
          )}
        </div>
      )}

      <div className="grid g4">
        <Kpi
          title="Registered users"
          value={o.users.total.toLocaleString()}
          sub={`+${o.users.lastWeek} in the last 7 days`}
        />
        <Kpi
          title="Signed in now"
          value={o.users.active.toLocaleString()}
          sub="Accounts with an active session"
        />
        <Kpi
          title="Identity verified"
          value={(kyc.verified ?? 0).toLocaleString()}
          sub={`${o.inReview} waiting · ${kyc.rejected ?? 0} rejected`}
        />
        <Kpi
          title="Sandbox transactions"
          value={o.transactions.total.toLocaleString()}
          sub={`${o.transactions.lastWeek} in the last 7 days`}
        />
      </div>

      <div className="grid g2 mt">
        <section className="card pad">
          <h3 className="adm-h3">New accounts</h3>
          <Bars
            label="Signups"
            points={o.signups.map((s) => ({ day: s.day, value: s.total }))}
          />
        </section>
        <section className="card pad">
          <h3 className="adm-h3">Sandbox activity</h3>
          <Bars
            label="Transactions"
            points={o.volume.map((v) => ({ day: v.day, value: v.total }))}
          />
          <p className="xs mut m0">
            Simulated value moved in 30 days: {money(volume30 / 100)}
          </p>
        </section>
      </div>

      <div className="grid g3 mt">
        <section className="card pad">
          <h3 className="adm-h3">Identity verification</h3>
          <div className="adm-donut">
            <Donut
              items={FUNNEL.map(([key, text]) => ({
                label: text,
                value: kyc[key] ?? 0,
              }))}
            />
          </div>
        </section>
        <section className="card pad">
          <h3 className="adm-h3">Accounts</h3>
          <ul className="adm-legend">
            <li>
              <span>Email verified</span>
              <b>{o.users.verifiedEmail}</b>
            </li>
            <li>
              <span>Admins</span>
              <b>{o.users.admins}</b>
            </li>
            <li>
              <span>Suspended</span>
              <b>{o.users.suspended}</b>
            </li>
            <li>
              <span>Business verifications</span>
              <b>{o.verification.kyb?.verified ?? 0}</b>
            </li>
          </ul>
          <Link className="btn btn-s btn-sm mt" href="/admin/users">
            Manage users
          </Link>
        </section>
        <section className="card pad">
          <h3 className="adm-h3">Interest and support</h3>
          <ul className="adm-legend">
            <li>
              <span>Waitlist</span>
              <b>{o.waitlist}</b>
            </li>
            <li>
              <span>Contact messages</span>
              <b>{o.messages}</b>
            </li>
            <li>
              <span>Open tickets</span>
              <b>{o.tickets.open ?? 0}</b>
            </li>
            <li>
              <span>Resolved tickets</span>
              <b>{o.tickets.resolved ?? 0}</b>
            </li>
          </ul>
          <Link className="btn btn-s btn-sm mt" href="/admin/support">
            Open support
          </Link>
        </section>
      </div>
    </>
  );
}
