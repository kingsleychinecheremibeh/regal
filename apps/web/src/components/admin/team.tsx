"use client";

import { useState } from "react";
import { Modal, Table } from "@/components/dashboard/ui";
import { date, dateTime } from "@/lib/format";
import {
  Head,
  Notice,
  ROLE_LABEL,
  useAction,
  useAdmin,
  useCan,
  useMe,
  type AdminRole,
} from "./shared";

type Member = {
  id: string;
  fullName: string;
  email: string;
  adminRole: AdminRole | null;
  createdAt: string;
  lastSignIn: string | null;
};

const ROLES: [AdminRole, string][] = [
  ["owner", "Everything, including team, announcements and exports"],
  ["compliance", "Verification decisions, suspensions and notes"],
  ["support", "Ticket replies, password resets, sign-outs and notes"],
  ["viewer", "Read-only access to every page"],
];

export function AdminTeam() {
  const { data, error, reload } = useAdmin<Member[]>("admin/team");
  const me = useMe();
  const { busy, notice, run } = useAction(reload);
  const can = useCan();
  const [form, setForm] = useState<{ email: string; role: AdminRole }>({
    email: "",
    role: "support",
  });
  const [removing, setRemoving] = useState<Member | null>(null);

  return (
    <>
      <Head
        title="Team and roles"
        sub="Who can use the admin console and what each person is allowed to do."
      />
      <Notice notice={notice} />
      <div className="grid g2 mb">
        {can("owner") && (
          <section className="card pad">
            <h3 className="adm-h3">Add a team member</h3>
            <p className="xs mut">
              They need a TurboXGlobal account first. Their access starts the
              next time they sign in.
            </p>
            <label className="adm-field">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="colleague@company.com"
              />
            </label>
            <label className="adm-field mt">
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as AdminRole })
                }
              >
                {ROLES.map(([key]) => (
                  <option key={key} value={key}>
                    {ROLE_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-p btn-sm mt"
              disabled={!!busy || !form.email.includes("@")}
              onClick={async () => {
                if (await run("add", "admin/team", form))
                  setForm({ email: "", role: "support" });
              }}
            >
              Add to team
            </button>
          </section>
        )}
        <section className="card pad">
          <h3 className="adm-h3">What each role can do</h3>
          <ul className="adm-legend">
            {ROLES.map(([key, text]) => (
              <li key={key}>
                <b>{ROLE_LABEL[key]}</b>
                <span className="mut" style={{ textAlign: "right" }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {error && <p className="err-t">{error}</p>}
      <section className="card pad adm-table">
        {!data ? (
          <p className="mut">Loading…</p>
        ) : (
          <Table
            head={["Member", "Role", "Admin since", "Last sign-in", ""]}
            rows={data.map((m) => {
              const role = m.adminRole ?? "owner";
              const self = m.email === me.email;
              return [
                <span key="m" className="adm-user">
                  <b>{m.fullName}</b>
                  <span className="xs mut">{m.email}</span>
                </span>,
                can("owner") && !self ? (
                  <select
                    key="r"
                    aria-label={`Role for ${m.fullName}`}
                    value={role}
                    disabled={!!busy}
                    onChange={(e) =>
                      run(m.id, `admin/team/${m.id}/role`, {
                        role: e.target.value,
                      })
                    }
                  >
                    {ROLES.map(([key]) => (
                      <option key={key} value={key}>
                        {ROLE_LABEL[key]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <b key="r">{ROLE_LABEL[role]}</b>
                ),
                date(m.createdAt),
                m.lastSignIn ? dateTime(m.lastSignIn) : "Never",
                can("owner") && !self ? (
                  <button
                    key="x"
                    className="btn btn-s btn-sm"
                    disabled={!!busy}
                    onClick={() => setRemoving(m)}
                  >
                    Remove
                  </button>
                ) : self ? (
                  <span key="x" className="xs mut">
                    You
                  </span>
                ) : (
                  ""
                ),
              ];
            })}
          />
        )}
      </section>
      {removing && (
        <Modal
          title={`Remove ${removing.fullName} from the team?`}
          onClose={() => setRemoving(null)}
          actions={
            <button
              className="btn btn-d"
              disabled={!!busy}
              onClick={async () => {
                if (await run("remove", `admin/team/${removing.id}/remove`))
                  setRemoving(null);
              }}
            >
              Remove access
            </button>
          }
        >
          <p>
            They keep their customer account but lose admin access straight away
            and are signed out.
          </p>
        </Modal>
      )}
    </>
  );
}
