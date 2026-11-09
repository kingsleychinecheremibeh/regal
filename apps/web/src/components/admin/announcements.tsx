"use client";

import { useState } from "react";
import { Badge, Table } from "@/components/dashboard/ui";
import { dateTime } from "@/lib/format";
import { Head, Notice, useAction, useAdmin, useCan } from "./shared";

type Row = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning";
  active: boolean;
  createdAt: string;
  author: string | null;
};

const TONES = [
  ["info", "Information"],
  ["success", "Good news"],
  ["warning", "Warning"],
] as const;

export function AdminAnnouncements() {
  const { data, error, reload } = useAdmin<Row[]>("admin/announcements");
  const { busy, notice, run } = useAction(reload);
  const can = useCan();
  const [form, setForm] = useState({ title: "", body: "", tone: "info" });

  return (
    <>
      <Head
        title="Announcements"
        sub="Messages shown as a banner at the top of every customer dashboard."
      />
      <Notice notice={notice} />
      {can("owner") && (
        <section className="card pad mb">
          <h3 className="adm-h3">New announcement</h3>
          <div className="grid g2">
            <label className="adm-field">
              Title
              <input
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Scheduled maintenance tonight"
              />
            </label>
            <label className="adm-field">
              Style
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
              >
                {TONES.map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="adm-field mt">
            Message
            <textarea
              rows={3}
              maxLength={600}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="TurboXGlobal will be unavailable from 10pm to 10:30pm WAT."
            />
          </label>
          {(form.title || form.body) && (
            <div className={`adm-banner ${form.tone} mt`} aria-label="Preview">
              <b>{form.title || "Title"}</b> {form.body}
            </div>
          )}
          <button
            className="btn btn-p btn-sm mt"
            disabled={!!busy || form.title.length < 3 || form.body.length < 3}
            onClick={async () => {
              if (await run("create", "admin/announcements", form))
                setForm({ title: "", body: "", tone: "info" });
            }}
          >
            Publish to all dashboards
          </button>
        </section>
      )}
      {error && <p className="err-t">{error}</p>}
      <section className="card pad adm-table">
        {!data ? (
          <p className="mut">Loading…</p>
        ) : (
          <Table
            head={["Announcement", "Status", "Published", ""]}
            empty="No announcements yet."
            rows={data.map((a) => [
              <div key="a" className={`adm-banner ${a.tone}`}>
                <b>{a.title}</b> {a.body}
              </div>,
              a.active ? (
                <Badge key="s" tone="b-ok" text="Showing" />
              ) : (
                <Badge key="s" tone="b-mut" text="Hidden" />
              ),
              <span key="p">
                {dateTime(a.createdAt)}
                <div className="xs mut">{a.author ?? ""}</div>
              </span>,
              can("owner") ? (
                <button
                  key="t"
                  className="btn btn-s btn-sm"
                  disabled={!!busy}
                  onClick={() =>
                    run(a.id, `admin/announcements/${a.id}`, {
                      active: !a.active,
                    })
                  }
                >
                  {a.active ? "Hide" : "Show again"}
                </button>
              ) : (
                ""
              ),
            ])}
          />
        )}
      </section>
    </>
  );
}
