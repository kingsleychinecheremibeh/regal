"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import type { Overview } from "@/lib/types";
import { useAction, useDash, useData } from "./context";
import {
  Badge,
  Field,
  Modal,
  PageHead,
  Skeleton,
  Table,
  Tabs,
  Toggle,
} from "./ui";
import { Verification } from "./verification";

const TABS = [
  "Profile",
  "Verification",
  "Security",
  "Notifications",
  "Limits",
  "Demo data",
] as const;
type Tab = (typeof TABS)[number];

function Profile() {
  const { state } = useDash();
  const { pending, run } = useAction();
  const [name, setName] = useState(state?.user.fullName ?? "");
  const [error, setError] = useState("");
  return (
    <div style={{ maxWidth: 520 }}>
      <Field label="Full name" id="s-name">
        <input
          id="s-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field
        label="Email"
        id="s-email"
        hint="Your sign-in email cannot be changed in the preview."
      >
        <input id="s-email" value={state?.user.email ?? ""} disabled />
      </Field>
      <p className="err-t" role="alert">
        {error}
      </p>
      <button
        className="btn btn-d"
        disabled={pending}
        onClick={() =>
          run(
            () =>
              api("users/me", { method: "PATCH", body: { fullName: name } }),
            {
              success: "Profile saved.",
              onError: setError,
            },
          )
        }
      >
        Save changes
      </button>
    </div>
  );
}

function AccountType() {
  const { state } = useDash();
  const { pending, run } = useAction();
  const [name, setName] = useState(state?.profile.businessName ?? "");
  const [error, setError] = useState("");
  if (!state) return null;
  const business = state.profile.accountType === "business";
  return (
    <div className="card pad mb">
      <div className="row sp">
        <h3 className="m0">Account type</h3>
        <Badge tone="b-info" text={business ? "Business" : "Personal"} />
      </div>
      {business ? (
        <p className="sm mut m0 mt">
          Business account for <b>{state.profile.businessName}</b>. Complete
          business verification below to unlock Fiat Acquiring.
        </p>
      ) : (
        <>
          <p className="sm mut">
            Switch to a business account to accept payments. You will be asked
            to verify the business (KYB).
          </p>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="grow" style={{ maxWidth: 360 }}>
              <Field label="Business name" id="s-biz">
                <input
                  id="s-biz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <div className="field">
              <button
                className="btn btn-d"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      api("demo/profile", {
                        method: "PATCH",
                        body: { accountType: "business", businessName: name },
                      }),
                    {
                      success: "Business account opened. Complete KYB next.",
                      onError: setError,
                    },
                  )
                }
              >
                Switch to business
              </button>
            </div>
          </div>
          <p className="err-t" role="alert">
            {error}
          </p>
        </>
      )}
    </div>
  );
}

type Session = { id: string; createdAt: string; expiresAt: string };

function Security() {
  const router = useRouter();
  const { state } = useDash();
  const { pending, run } = useAction();
  const sessions = useData<Session[]>("auth/sessions");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [mfa, setMfa] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

  async function changePassword() {
    setPwError("");
    if (pw.next.length < 12) return setPwError("Use at least 12 characters.");
    if (pw.next !== pw.confirm)
      return setPwError("The new passwords do not match.");
    const result = await run(
      () =>
        api("users/me/password", {
          method: "PATCH",
          body: { currentPassword: pw.current, newPassword: pw.next },
        }),
      {
        success: "Password changed. Please sign in again.",
        onError: setPwError,
      },
    );
    if (result) router.replace("/sign-in");
  }

  async function confirmMfa() {
    setCodeError("");
    if (!/^\d{6}$/.test(code)) return setCodeError("Enter the 6-digit code.");
    const result = await run(
      () =>
        api("demo/profile", {
          method: "PATCH",
          body: { mfa: { enabled: mfa, code } },
        }),
      { onError: setCodeError },
    );
    if (result) {
      setMfa(null);
      setCode("");
    }
  }

  return (
    <>
      <div className="grid g2">
        <div className="card pad">
          <h3>Password</h3>
          <Field label="Current password" id="pw0">
            <input
              id="pw0"
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </Field>
          <Field label="New password" id="pw1" hint="At least 12 characters.">
            <input
              id="pw1"
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
          </Field>
          <Field label="Confirm new password" id="pw2">
            <input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            />
          </Field>
          <p className="err-t" role="alert">
            {pwError}
          </p>
          <button
            className="btn btn-d"
            onClick={changePassword}
            disabled={pending}
          >
            Change password
          </button>
          <p className="xs mut mt m0">
            Changing it signs out every session, including this one.
          </p>
        </div>
        <div className="card pad" style={{ alignSelf: "start" }}>
          <div className="row sp">
            <div>
              <h3 className="m0">Multi-factor authentication</h3>
              <p className="sm mut m0" style={{ marginTop: 4 }}>
                {state?.profile.mfaEnabled
                  ? "On. A code is needed to reveal card details."
                  : "Off. Turn it on to protect your account."}
              </p>
            </div>
            <Toggle
              checked={!!state?.profile.mfaEnabled}
              label="Multi-factor authentication"
              onChange={(value) => setMfa(value)}
            />
          </div>
          <p className="xs mut mt m0">
            Simulated in the preview: sign-in does not ask for a code.
          </p>
        </div>
      </div>
      <div className="card pad mt">
        <div className="row sp">
          <h3 className="m0">Active sessions</h3>
          <button
            className="btn btn-s btn-sm"
            onClick={async () => {
              await api("auth/logout-all", { method: "POST" }).catch(
                () => undefined,
              );
              router.replace("/sign-in");
            }}
          >
            Sign out everywhere
          </button>
        </div>
        <div className="mt">
          {!sessions.data ? (
            <p className="mut">Loading…</p>
          ) : (
            <Table
              head={["Signed in", "Expires", ""]}
              rows={sessions.data.map((s) => [
                dateTime(s.createdAt),
                dateTime(s.expiresAt),
                <button
                  key="r"
                  className="btn btn-s btn-sm"
                  onClick={() =>
                    run(
                      () => api(`auth/sessions/${s.id}`, { method: "DELETE" }),
                      {
                        success: "Session signed out.",
                      },
                    )
                  }
                >
                  Sign out
                </button>,
              ])}
            />
          )}
        </div>
      </div>
      {mfa !== null && (
        <Modal
          title={mfa ? "Set up MFA" : "Turn off MFA?"}
          onClose={() => setMfa(null)}
          actions={
            <button
              className={`btn ${mfa ? "btn-d" : "btn-x"}`}
              onClick={confirmMfa}
              disabled={pending}
            >
              {mfa ? "Turn on" : "Turn off"}
            </button>
          }
        >
          {mfa && (
            <>
              <p>Add this key to an authenticator app, then enter the code.</p>
              <p>
                <code>JBSW Y3DP EHPK 3PXP</code>{" "}
                <span className="xs mut">(sample key)</span>
              </p>
            </>
          )}
          <Field
            label="6-digit code"
            id="m0"
            hint="Investor preview: any 6 digits work."
          >
            <input
              id="m0"
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
    </>
  );
}

function Notifications() {
  const { state } = useDash();
  const { run } = useAction();
  if (!state) return null;
  const prefs = {
    email: true,
    push: true,
    sms: false,
    marketing: false,
    ...state.profile.notify,
  };
  const rows: [keyof typeof prefs | "security", string][] = [
    ["email", "Email alerts"],
    ["push", "Push notifications"],
    ["sms", "SMS alerts"],
    ["security", "Security alerts (always on)"],
    ["marketing", "Product news and offers"],
  ];
  return (
    <div className="card pad" style={{ maxWidth: 560 }}>
      {rows.map(([key, text]) => (
        <div className="lrow" key={key}>
          <span>{text}</span>
          <Toggle
            label={text}
            checked={key === "security" ? true : prefs[key]}
            disabled={key === "security"}
            onChange={(value) =>
              key !== "security" &&
              run(() =>
                api("demo/profile", {
                  method: "PATCH",
                  body: { notify: { ...prefs, [key]: value } },
                }),
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

function Limits() {
  const { verified } = useDash();
  const { data } = useData<Overview>("demo/overview");
  if (!data) return <Skeleton />;
  return (
    <Table
      head={["Limit", "Maximum", "Used today"]}
      rows={[
        [
          "Daily trading",
          money(data.limits.trading.max),
          verified ? money(data.limits.trading.used) : "Verify first",
        ],
        [
          "Daily transfers and withdrawals",
          money(data.limits.transfers.max),
          verified ? money(data.limits.transfers.used) : "Verify first",
        ],
        ["Single transfer or withdrawal", money(5000), "—"],
        [
          "Card monthly spend",
          "Set per card, up to 5,000 USD",
          "See Virtual Cards",
        ],
      ]}
    />
  );
}

function DemoData() {
  const { pending, run } = useAction();
  const [confirm, setConfirm] = useState<"balances" | "everything" | null>(
    null,
  );
  return (
    <div className="card pad" style={{ maxWidth: 620 }}>
      <h3>Reset demo data</h3>
      <p className="sm mut">
        Use this between investor sessions. Your sign-in and profile are never
        affected.
      </p>
      <div className="row">
        <button className="btn btn-s" onClick={() => setConfirm("balances")}>
          Reset balances and activity
        </button>
        <button className="btn btn-x" onClick={() => setConfirm("everything")}>
          Start over as a new user
        </button>
      </div>
      <p className="xs mut mt m0">
        Resetting balances keeps your verification and restores the opening demo
        funds. Starting over also resets KYC, KYB and the account type.
      </p>
      {confirm && (
        <Modal
          title={
            confirm === "balances"
              ? "Reset balances and activity?"
              : "Start over as a new user?"
          }
          onClose={() => setConfirm(null)}
          actions={
            <button
              className="btn btn-x"
              disabled={pending}
              onClick={async () => {
                await run(
                  () =>
                    api("demo/reset", {
                      body: { verification: confirm === "everything" },
                    }),
                  { success: "Demo data reset." },
                );
                setConfirm(null);
              }}
            >
              Reset
            </button>
          }
        >
          <p>
            This removes your simulated transactions, cards, beneficiaries,
            orders and notifications.
            {confirm === "everything" &&
              " Verification goes back to Not Started."}
          </p>
        </Modal>
      )}
    </div>
  );
}

export function Settings() {
  const params = useSearchParams();
  const initial = TABS.find((t) => t === params.get("tab")) ?? "Profile";
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <>
      <PageHead title="Settings" />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "Profile" && (
        <div className="card pad">
          <Profile />
        </div>
      )}
      {tab === "Verification" && (
        <>
          <AccountType />
          <Verification />
        </>
      )}
      {tab === "Security" && <Security />}
      {tab === "Notifications" && <Notifications />}
      {tab === "Limits" && <Limits />}
      {tab === "Demo data" && <DemoData />}
    </>
  );
}
