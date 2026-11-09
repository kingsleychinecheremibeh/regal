"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { dateTime } from "@/lib/format";
import { Head, useAdmin } from "./shared";

type Status = {
  checkedAt: string;
  api: {
    ok: boolean;
    uptimeSeconds: number;
    node: string;
    environment: string;
    memoryMb: number;
  };
  database: { ok: boolean; latencyMs: number; error?: string };
  email: { ok: boolean; provider: string };
  driver: string;
};

const uptime = (seconds: number) => {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function Tile({
  name,
  state,
  headline,
  details,
}: {
  name: string;
  state: "ok" | "warn" | "down";
  headline: string;
  details: [string, string][];
}) {
  const text = { ok: "Operational", warn: "Degraded", down: "Down" }[state];
  return (
    <section className={`card pad adm-status ${state}`}>
      <div className="row sp">
        <h3 className="adm-h3 m0">{name}</h3>
        <span className="adm-dot">
          <i aria-hidden="true" /> {text}
        </span>
      </div>
      <p className="adm-status-head">{headline}</p>
      <dl className="adm-kv sm">
        {details.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AdminStatus() {
  const { data, error, reload } = useAdmin<Status>("admin/status");
  useEffect(() => {
    const timer = setInterval(reload, 30_000);
    return () => clearInterval(timer);
  }, [reload]);

  const dbState = !data
    ? "warn"
    : !data.database.ok
      ? "down"
      : data.database.latencyMs > 800
        ? "warn"
        : "ok";
  const all =
    data && data.api.ok && data.database.ok && data.email.ok
      ? "All systems operational"
      : data && data.database.ok
        ? "Running with warnings"
        : "Service disruption";

  return (
    <>
      <Head
        title="System status"
        sub="Live health of the TurboXGlobal platform. Refreshes every 30 seconds."
        action={
          <button className="btn btn-s btn-sm" onClick={reload}>
            <RefreshCw size={15} aria-hidden="true" /> Check now
          </button>
        }
      />
      {error && (
        <div className="adm-overall down">The API did not respond: {error}</div>
      )}
      {data && (
        <>
          <div
            className={`adm-overall ${data.database.ok && data.email.ok ? "ok" : data.database.ok ? "warn" : "down"}`}
          >
            <b>{all}</b>
            <span className="xs">Last checked {dateTime(data.checkedAt)}</span>
          </div>
          <div className="grid g3 mt">
            <Tile
              name="API"
              state="ok"
              headline={`Up for ${uptime(data.api.uptimeSeconds)}`}
              details={[
                ["Environment", data.api.environment],
                ["Runtime", `Node ${data.api.node}`],
                ["Memory", `${data.api.memoryMb} MB`],
              ]}
            />
            <Tile
              name="Database"
              state={dbState}
              headline={
                data.database.ok
                  ? `Responding in ${data.database.latencyMs} ms`
                  : (data.database.error ?? "Not responding")
              }
              details={[
                ["Provider", "Neon PostgreSQL"],
                [
                  "Connection",
                  data.driver === "neon-websocket"
                    ? "Secure WebSocket"
                    : "Direct",
                ],
              ]}
            />
            <Tile
              name="Email delivery"
              state={data.email.ok ? "ok" : "warn"}
              headline={
                data.email.ok
                  ? "Ready to send verification and reset emails"
                  : "Not configured: sign-up emails cannot be sent"
              }
              details={[["Provider", data.email.provider]]}
            />
          </div>
        </>
      )}
      {!data && !error && <p className="mut">Checking…</p>}
    </>
  );
}
