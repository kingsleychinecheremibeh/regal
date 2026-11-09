"use client";

import { Download } from "lucide-react";
import { Kpi, Table } from "@/components/dashboard/ui";
import { label, money, TYPE_LABEL } from "@/lib/format";
import { Head, useAdmin, useCan } from "./shared";

type Report = {
  weekly: { week: string; total: number }[];
  verifiedWeekly: { week: string; total: number }[];
  funnel: { step: string; total: number }[];
  usage: { type: string; total: number; users: number; usdCents: number }[];
  waitlist: { total: number; joined: number };
  cards: number;
};

/** Last 12 Mondays, oldest first, as YYYY-MM-DD in UTC. */
function lastWeeks(): string[] {
  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() - (11 - i) * 7);
    return d.toISOString().slice(0, 10);
  });
}

function WeekBars({
  a,
  b,
}: {
  a: { week: string; total: number }[];
  b: { week: string; total: number }[];
}) {
  const weeks = lastWeeks();
  const av = new Map(a.map((x) => [x.week, x.total]));
  const bv = new Map(b.map((x) => [x.week, x.total]));
  const max = Math.max(
    1,
    ...weeks.map((w) => (av.get(w) ?? 0) + 0),
    ...weeks.map((w) => bv.get(w) ?? 0),
  );
  return (
    <figure className="adm-weeks" aria-label="Weekly signups and verifications">
      <div className="adm-weeks-plot">
        {weeks.map((w) => (
          <div
            key={w}
            title={`Week of ${w}: ${av.get(w) ?? 0} signups, ${bv.get(w) ?? 0} verified`}
          >
            <span
              className="s"
              style={{ height: `${((av.get(w) ?? 0) / max) * 100}%` }}
            />
            <span
              className="v"
              style={{ height: `${((bv.get(w) ?? 0) / max) * 100}%` }}
            />
            <small>{w.slice(5)}</small>
          </div>
        ))}
      </div>
      <figcaption className="row xs mut">
        <span className="adm-key s" /> Signups
        <span className="adm-key v" /> Identity verified
      </figcaption>
    </figure>
  );
}

export function AdminReports() {
  const { data: r, error } = useAdmin<Report>("admin/reports");
  const can = useCan();
  if (error) return <p className="err-t">{error}</p>;
  if (!r) return <p className="mut">Loading…</p>;
  const top = Math.max(1, r.funnel[0]?.total ?? 1);
  const conversion = r.waitlist.total
    ? Math.round((r.waitlist.joined / r.waitlist.total) * 100)
    : 0;

  return (
    <>
      <Head
        title="Reports"
        sub="Growth, verification and product usage over the last 12 weeks."
        action={
          can("owner") && (
            <a className="btn btn-s btn-sm" href="/api/v1/admin/reports.csv">
              <Download size={15} aria-hidden="true" /> Download CSV
            </a>
          )
        }
      />
      <div className="grid g4">
        <Kpi
          title="Signups, 12 weeks"
          value={r.weekly.reduce((s, w) => s + w.total, 0)}
        />
        <Kpi
          title="Verified, 12 weeks"
          value={r.verifiedWeekly.reduce((s, w) => s + w.total, 0)}
        />
        <Kpi
          title="Waitlist to account"
          value={`${conversion}%`}
          sub={`${r.waitlist.joined} of ${r.waitlist.total} signed up`}
        />
        <Kpi title="Virtual cards created" value={r.cards} />
      </div>
      <div className="grid g2 mt">
        <section className="card pad">
          <h3 className="adm-h3">Weekly growth</h3>
          <WeekBars a={r.weekly} b={r.verifiedWeekly} />
        </section>
        <section className="card pad">
          <h3 className="adm-h3">Onboarding funnel</h3>
          <div className="adm-funnel">
            {r.funnel.map((f, i) => (
              <div key={f.step}>
                <div className="row sp xs">
                  <b>{f.step}</b>
                  <span>
                    {f.total}
                    {i > 0 && (
                      <span className="mut">
                        {" "}
                        · {Math.round((f.total / top) * 100)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="adm-funnel-bar">
                  <span style={{ width: `${(f.total / top) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="card pad mt adm-table">
        <h3 className="adm-h3">
          Product usage{" "}
          <span className="xs mut">all time, simulated values</span>
        </h3>
        <Table
          head={[
            "Product action",
            "Transactions",
            "Customers",
            "Simulated value",
          ]}
          empty="No activity yet."
          rows={r.usage.map((u) => [
            TYPE_LABEL[u.type] ?? label(u.type),
            u.total.toLocaleString(),
            u.users.toLocaleString(),
            money(u.usdCents / 100),
          ])}
        />
      </section>
    </>
  );
}
