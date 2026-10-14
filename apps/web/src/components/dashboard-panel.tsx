"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { modules } from "@/lib/dashboard-modules";

type Overview = {
  label: string;
  currency: string;
  balances: {
    cashMinor: number;
    savingsMinor: number;
    investmentMinor: number;
    points: number;
  } | null;
  transactions: {
    id: string;
    kind: string;
    amountMinor: number;
    description: string;
    createdAt: string;
  }[];
  goals: {
    id: string;
    name: string;
    targetMinor: number;
    savedMinor: number;
  }[];
  cards: { id: string; label: string; frozen: boolean; limitMinor: number }[];
  notifications: { id: string; message: string }[];
};
type Market = {
  name: string;
  symbol: string;
  examplePriceMinor: number;
  exampleChangePercent: number;
};
const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
async function request(
  path: string,
  method = "GET",
  body?: object,
  idempotency = false,
) {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotency ? { "Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Request failed");
  return result;
}

function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dash-box">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Notice({
  text = "Illustrative demo values. No real assets, accounts, payments or returns.",
}: {
  text?: string;
}) {
  return (
    <p className="dash-notice">
      <Shield size={16} />
      {text}
    </p>
  );
}

export function DashboardPanel({ module }: { module: string }) {
  const router = useRouter();
  const selected = modules.find((item) => item.slug === module) ?? modules[0];
  const [overview, setOverview] = useState<Overview | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [sessions, setSessions] = useState<
    { id: string; createdAt: string; expiresAt: string }[]
  >([]);
  const [profile, setProfile] = useState<{
    fullName: string;
    email: string;
    emailVerifiedAt: string | null;
    provisionedAt: string | null;
  } | null>(null);
  const [preferences, setPreferences] = useState<{
    emailUpdates: boolean;
    demoAutoSave: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reload = useCallback(async () => {
    const [o, m] = await Promise.all([
      request("demo/overview"),
      request("demo/markets"),
    ]);
    setOverview(o);
    setMarkets(m.assets);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([request("demo/overview"), request("demo/markets")])
      .then(([o, m]) => {
        if (active) {
          setOverview(o);
          setMarkets(m.assets);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    if (module === "settings") {
      request("users/me")
        .then(setProfile)
        .catch(() => {});
      request("auth/sessions")
        .then(setSessions)
        .catch(() => {});
      request("users/me/preferences")
        .then(setPreferences)
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [module]);
  async function act(
    path: string,
    body?: object,
    method = "POST",
    idempotency = false,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, method, body, idempotency);
      await reload();
      setMessage("Demo action saved.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function formAction(
    event: FormEvent<HTMLFormElement>,
    path: string,
    build: (data: FormData) => object,
    idempotency = false,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const body = build(new FormData(form));
      if (await act(path, body, "POST", idempotency)) form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid input");
    }
  }
  const cash = overview?.balances?.cashMinor ?? 0;
  return (
    <main className="dashboard-content">
      <div className="dash-page-heading">
        <div>
          <span className="section-kicker">
            REGALVEST / {selected.label.toUpperCase()}
          </span>
          <h1>{selected.label}</h1>
          <p>Explore a personal, simulated Regalvest experience.</p>
        </div>
        <span className="demo-label">DEMO DATA</span>
      </div>
      <Notice />
      {error && (
        <p className="form-error" role="alert">
          {error} <button onClick={() => void reload()}>Retry</button>
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {!overview ? (
        <p className="dash-loading">Loading your demo workspace…</p>
      ) : (
        <>
          {module === "overview" && (
            <>
              <div className="dash-stats">
                <Box title="Demo portfolio">
                  <strong>
                    {money(
                      cash +
                        overview.balances!.savingsMinor +
                        overview.balances!.investmentMinor,
                    )}
                  </strong>
                  <small>Sample total balance</small>
                </Box>
                <Box title="Available demo cash">
                  <strong>{money(cash)}</strong>
                  <small>Simulated USD</small>
                </Box>
                <Box title="SmartSave">
                  <strong>{money(overview.balances!.savingsMinor)}</strong>
                  <small>Simulated savings</small>
                </Box>
                <Box title="VestPoints">
                  <strong>{overview.balances!.points}</strong>
                  <small>Demo rewards</small>
                </Box>
              </div>
              <div className="dash-two">
                <Box title="Quick actions">
                  <div className="dash-action-links">
                    <Link href="/dashboard/tradehub">Explore trading →</Link>
                    <Link href="/dashboard/smartsave">Move demo savings →</Link>
                    <Link href="/dashboard/regalpay">Preview a payment →</Link>
                  </div>
                </Box>
                <Box title="Recent transactions">
                  <TransactionList rows={overview.transactions} />
                </Box>
              </div>
              <Box title="Your demo assets">
                <p>
                  Cash, savings and simulated investments are tracked
                  separately. Actions in this workspace cannot move real money.
                </p>
              </Box>
            </>
          )}
          {module === "markets" && (
            <>
              <Box title="Illustrative market board">
                <MarketTable rows={markets} />
              </Box>
              <Notice text="Prices and changes are fixed examples for this demonstration, not live quotes." />
            </>
          )}
          {module === "tradehub" && (
            <>
              <div className="dash-tabs">
                <span>Crypto</span>
                <span>P2P trading · planned</span>
                <span>Gift cards · planned</span>
                <span>Staking · planned</span>
              </div>
              <div className="dash-two">
                <Box title="Simulate a trade">
                  <MoneyForm
                    busy={busy}
                    label="Confirm demo trade"
                    fields="trade"
                    onSubmit={(e) =>
                      formAction(
                        e,
                        "demo/trades",
                        (d) => ({
                          amountMinor: Math.round(
                            Number(d.get("amount")) * 100,
                          ),
                          description: `Demo trade in ${d.get("symbol")}`,
                          symbol: d.get("symbol"),
                        }),
                        true,
                      )
                    }
                  />
                </Box>
                <Box title="Example price reference">
                  <MarketTable rows={markets} />
                </Box>
              </div>
              <Box title="Order history">
                <TransactionList
                  rows={overview.transactions.filter((t) => t.kind === "trade")}
                />
              </Box>
            </>
          )}
          {module === "otc" && (
            <>
              <Box title="OTC desk preview">
                <p>
                  Explore how an over-the-counter quote might be requested.
                  Settlement, counterparties and execution are planned.
                </p>
                <MoneyForm
                  busy={busy}
                  label="Submit simulated order"
                  fields="trade"
                  onSubmit={(e) =>
                    formAction(
                      e,
                      "demo/trades",
                      (d) => ({
                        amountMinor: Math.round(Number(d.get("amount")) * 100),
                        description: `Demo OTC order for ${d.get("symbol")}`,
                        symbol: d.get("symbol"),
                      }),
                      true,
                    )
                  }
                />
              </Box>
              <Box title="Example order history">
                <TransactionList
                  rows={overview.transactions.filter((t) =>
                    t.description.includes("OTC"),
                  )}
                />
              </Box>
            </>
          )}
          {module === "regalpay" && (
            <>
              <div className="dash-two">
                <Box title="Simulated transfer">
                  <MoneyForm
                    busy={busy}
                    label="Confirm demo transfer"
                    fields="transfer"
                    onSubmit={(e) =>
                      formAction(
                        e,
                        "demo/transfers",
                        (d) => ({
                          amountMinor: Math.round(
                            Number(d.get("amount")) * 100,
                          ),
                          description: `Demo transfer to ${d.get("recipient")}`,
                        }),
                        true,
                      )
                    }
                  />
                </Box>
                <Box title="Payment previews">
                  <ul className="feature-list">
                    <li>Utility bills — planned</li>
                    <li>Airtime and data — planned</li>
                    <li>Global transfers — planned</li>
                    <li>Bill reminders — planned</li>
                  </ul>
                </Box>
              </div>
              <Box title="Payment history">
                <TransactionList
                  rows={overview.transactions.filter(
                    (t) => t.kind === "transfer",
                  )}
                />
              </Box>
            </>
          )}
          {module === "smartsave" && (
            <>
              <div className="dash-stats">
                <Box title="Saved in demo">
                  <strong>{money(overview.balances!.savingsMinor)}</strong>
                </Box>
                <Box title="Goals">
                  <strong>{overview.goals.length}</strong>
                </Box>
              </div>
              <div className="dash-two">
                <Box title="Create a savings goal">
                  <form
                    className="dash-form"
                    onSubmit={(e) =>
                      formAction(e, "demo/savings/goals", (d) => ({
                        name: String(d.get("name")),
                        targetMinor: Math.round(Number(d.get("target")) * 100),
                      }))
                    }
                  >
                    <label>
                      Goal name
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Target (demo USD)
                      <input
                        name="target"
                        type="number"
                        min="1"
                        step="0.01"
                        required
                      />
                    </label>
                    <button className="orange-button" disabled={busy}>
                      Create goal
                    </button>
                  </form>
                </Box>
                <Box title="Move demo savings">
                  <MoneyForm
                    busy={busy}
                    label="Save demo cash"
                    goals={overview.goals}
                    onSubmit={(e) =>
                      formAction(
                        e,
                        "demo/savings/deposit",
                        (d) => ({
                          amountMinor: Math.round(
                            Number(d.get("amount")) * 100,
                          ),
                          description: "Demo savings deposit",
                          ...(d.get("goalId")
                            ? { goalId: d.get("goalId") }
                            : {}),
                        }),
                        true,
                      )
                    }
                  />
                  <div className="dash-form-divider" />
                  <MoneyForm
                    busy={busy}
                    label="Withdraw demo savings"
                    goals={overview.goals}
                    onSubmit={(e) =>
                      formAction(
                        e,
                        "demo/savings/withdraw",
                        (d) => ({
                          amountMinor: Math.round(
                            Number(d.get("amount")) * 100,
                          ),
                          description: "Demo savings withdrawal",
                          ...(d.get("goalId")
                            ? { goalId: d.get("goalId") }
                            : {}),
                        }),
                        true,
                      )
                    }
                  />
                </Box>
              </div>
              <Box title="Your goals">
                {overview.goals.length ? (
                  overview.goals.map((g) => (
                    <div className="dash-row" key={g.id}>
                      <span>{g.name}</span>
                      <strong>
                        {money(g.savedMinor)} / {money(g.targetMinor)}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p>No goals yet. Create one above.</p>
                )}
              </Box>
            </>
          )}
          {module === "wealth" && (
            <>
              <div className="dash-stats">
                <Box title="Demo investments">
                  <strong>{money(overview.balances!.investmentMinor)}</strong>
                </Box>
                <Box title="Illustrative performance">
                  <strong>—</strong>
                  <small>No return is calculated for simulated assets.</small>
                </Box>
              </div>
              <div className="dash-two">
                <Box title="Simulate an investment">
                  <MoneyForm
                    busy={busy}
                    label="Confirm demo investment"
                    fields="trade"
                    onSubmit={(e) =>
                      formAction(
                        e,
                        "demo/investments/orders",
                        (d) => ({
                          amountMinor: Math.round(
                            Number(d.get("amount")) * 100,
                          ),
                          description: `Demo investment in ${d.get("symbol")}`,
                          symbol: d.get("symbol"),
                        }),
                        true,
                      )
                    }
                  />
                </Box>
                <Box title="Planned categories">
                  <ul className="feature-list">
                    <li>Stocks and ETFs</li>
                    <li>Real estate</li>
                    <li>Agriculture</li>
                    <li>Commodities</li>
                  </ul>
                </Box>
              </div>
            </>
          )}
          {module === "accounts" && (
            <>
              <div className="dash-stats">
                {["USD", "GBP", "EUR", "NGN"].map((currency) => (
                  <Box title={`${currency} concept account`} key={currency}>
                    <strong>{currency === "USD" ? money(cash) : "—"}</strong>
                    <small>No real account number or institution</small>
                  </Box>
                ))}
              </div>
              <Box title="Account activity">
                <TransactionList rows={overview.transactions} />
              </Box>
            </>
          )}
          {module === "cards" && (
            <>
              <div className="dash-two">
                <Box title="Create a demo card">
                  <form
                    className="dash-form"
                    onSubmit={(e) =>
                      formAction(e, "demo/cards", (d) => ({
                        label: String(d.get("label")),
                      }))
                    }
                  >
                    <label>
                      Card label
                      <input
                        name="label"
                        required
                        minLength={2}
                        maxLength={80}
                        placeholder="Travel concept"
                      />
                    </label>
                    <button className="orange-button" disabled={busy}>
                      Create demo card
                    </button>
                  </form>
                </Box>
                <Box title="Card safety">
                  <p>
                    These are visual placeholders. No PAN, CVV, issuer or
                    payment network credentials are created.
                  </p>
                </Box>
              </div>
              <Box title="Your demo cards">
                {overview.cards.length ? (
                  overview.cards.map((card) => (
                    <div key={card.id} className="dash-row">
                      <span>•••• DEMO · {card.label}</span>
                      <button
                        className="outline-button"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            `demo/cards/${card.id}`,
                            { frozen: !card.frozen },
                            "PATCH",
                          )
                        }
                      >
                        {card.frozen ? "Unfreeze demo" : "Freeze demo"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No cards yet.</p>
                )}
              </Box>
            </>
          )}
          {module === "vestpoints" && (
            <>
              <div className="dash-stats">
                <Box title="Demo VestPoints">
                  <strong>{overview.balances!.points}</strong>
                  <small>Current tier: Bronze</small>
                </Box>
                <Box title="Tier path">
                  <strong>Bronze → Silver</strong>
                  <small>Illustrative progression</small>
                </Box>
              </div>
              <Box title="Daily check-in">
                <p>Earn 10 demo points once per UTC day.</p>
                <button
                  className="orange-button"
                  disabled={busy}
                  onClick={() => void act("demo/rewards/check-in")}
                >
                  Check in
                </button>
              </Box>
              <Box title="Reward preview">
                <p>
                  Redemption catalog and referrals are planned. No financial
                  value can be redeemed.
                </p>
              </Box>
            </>
          )}
          {module === "academy" && (
            <>
              <div className="dash-card-grid">
                {[
                  "Money movement across borders",
                  "Introduction to risk",
                  "How simulated portfolios work",
                  "Building a savings habit",
                ].map((name, index) => (
                  <Box title={name} key={name}>
                    <p>Educational preview · Lesson {index + 1}</p>
                    <p>Course playback and progress tracking are planned.</p>
                  </Box>
                ))}
              </div>
              <Box title="News and podcast">
                <p>
                  Editorial feeds are planned. No live third-party content is
                  presented.
                </p>
              </Box>
            </>
          )}
          {module === "business" && (
            <>
              <div className="dash-stats">
                <Box title="Example revenue">
                  <strong>—</strong>
                  <small>No live merchant account</small>
                </Box>
                <Box title="Invoices">
                  <strong>Planned</strong>
                </Box>
              </div>
              <div className="dash-card-grid">
                {[
                  "Invoicing and collection",
                  "Merchant tools",
                  "Cross-border payroll",
                  "Developer API",
                ].map((name) => (
                  <Box title={name} key={name}>
                    <p>
                      Planned business capability. No collection or payout
                      occurs here.
                    </p>
                  </Box>
                ))}
              </div>
            </>
          )}
          {module === "settings" && (
            <>
              <div className="dash-two">
                <Box title="Your real account">
                  <p>
                    <strong>{profile?.fullName}</strong>
                    <br />
                    {profile?.email}
                  </p>
                  <p>
                    {profile?.emailVerifiedAt
                      ? "Email verified. "
                      : profile?.provisionedAt
                        ? "Account created privately; email ownership has not been verified. "
                        : "Email not verified. "}
                    KYC/KYB is unavailable in this demo.
                  </p>
                  <form
                    className="dash-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        const name = String(
                          new FormData(e.currentTarget).get("fullName"),
                        );
                        setProfile(
                          await request("users/me", "PATCH", {
                            fullName: name,
                          }),
                        );
                        setMessage("Profile updated");
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Update failed",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Full name
                      <input
                        name="fullName"
                        key={profile?.fullName}
                        defaultValue={profile?.fullName}
                        required
                        minLength={2}
                      />
                    </label>
                    <button className="orange-button" disabled={busy}>
                      Save profile
                    </button>
                  </form>
                </Box>
                <Box title="Security and sessions">
                  <p>Active sessions: {sessions.length}</p>
                  {sessions.map((s) => (
                    <div className="dash-row" key={s.id}>
                      <span>
                        Signed in {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        className="outline-button"
                        onClick={async () => {
                          await request(`auth/sessions/${s.id}`, "DELETE");
                          setSessions(await request("auth/sessions"));
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                  {profile?.provisionedAt && !profile.emailVerifiedAt ? (
                    <p>
                      If you lose access, the database operator can reset your
                      password with the private account command.
                    </p>
                  ) : (
                    <Link href="/forgot-password">
                      Recover password by email →
                    </Link>
                  )}
                </Box>
              </div>
              <div className="dash-two">
                <Box title="Change password">
                  <form
                    className="dash-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      setBusy(true);
                      setError("");
                      try {
                        await request("users/me/password", "PATCH", {
                          currentPassword: data.get("currentPassword"),
                          newPassword: data.get("newPassword"),
                        });
                        router.replace("/sign-in");
                        router.refresh();
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Password change failed",
                        );
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Current password
                      <input
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <label>
                      New password
                      <input
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                      />
                    </label>
                    <button className="orange-button" disabled={busy}>
                      Change password
                    </button>
                  </form>
                </Box>
                <Box title="Preferences">
                  {preferences ? (
                    <form
                      className="dash-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        setBusy(true);
                        setError("");
                        try {
                          setPreferences(
                            await request("users/me/preferences", "PATCH", {
                              emailUpdates: data.get("emailUpdates") === "on",
                              demoAutoSave: data.get("demoAutoSave") === "on",
                            }),
                          );
                          setMessage("Preferences saved");
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Update failed",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <label className="check-line">
                        <input
                          name="emailUpdates"
                          type="checkbox"
                          defaultChecked={preferences.emailUpdates}
                        />{" "}
                        Email updates
                      </label>
                      <label className="check-line">
                        <input
                          name="demoAutoSave"
                          type="checkbox"
                          defaultChecked={preferences.demoAutoSave}
                        />{" "}
                        Demo auto-save preference
                      </label>
                      <button className="orange-button" disabled={busy}>
                        Save preferences
                      </button>
                    </form>
                  ) : (
                    <p>Loading preferences…</p>
                  )}
                </Box>
              </div>
              <Box title="Demo controls">
                <button
                  className="outline-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Reset your simulated balances, transactions, goals and cards?",
                      )
                    )
                      void act("demo/reset");
                  }}
                >
                  Reset demo data
                </button>
              </Box>
            </>
          )}
        </>
      )}
    </main>
  );
}

function TransactionList({ rows }: { rows: Overview["transactions"] }) {
  return rows.length ? (
    <div>
      {rows.map((row) => (
        <div className="dash-row" key={row.id}>
          <span>
            <strong>{row.description}</strong>
            <small>
              {new Date(row.createdAt).toLocaleDateString()} · {row.kind}
            </small>
          </span>
          <strong>{money(row.amountMinor)}</strong>
        </div>
      ))}
    </div>
  ) : (
    <p>No demo transactions yet.</p>
  );
}
function MarketTable({ rows }: { rows: Market[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Example price</th>
            <th>Example change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((asset) => (
            <tr key={asset.symbol}>
              <td>
                {asset.name} <small>{asset.symbol}</small>
              </td>
              <td>{money(asset.examplePriceMinor)}</td>
              <td>{asset.exampleChangePercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function MoneyForm({
  busy,
  label,
  fields,
  goals,
  onSubmit,
}: {
  busy: boolean;
  label: string;
  fields?: "trade" | "transfer";
  goals?: Overview["goals"];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="dash-form" onSubmit={onSubmit}>
      {fields === "trade" && (
        <label>
          Example asset
          <select name="symbol">
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="ETH">Ethereum (ETH)</option>
            <option value="SPY">S&P 500 ETF (SPY)</option>
          </select>
        </label>
      )}
      {fields === "transfer" && (
        <label>
          Fictional recipient label
          <input
            name="recipient"
            placeholder="Demo recipient"
            minLength={2}
            maxLength={60}
            required
          />
        </label>
      )}
      {goals && (
        <label>
          Savings allocation
          <select name="goalId">
            <option value="">Unallocated savings</option>
            {goals.map((goal) => (
              <option value={goal.id} key={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Amount (demo USD)
        <input
          name="amount"
          type="number"
          min="0.01"
          max="1000000"
          step="0.01"
          required
        />
      </label>
      <button className="orange-button" disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </form>
  );
}
