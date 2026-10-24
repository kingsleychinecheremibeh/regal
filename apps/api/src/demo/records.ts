import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  accountProfiles,
  demoApiKeys,
  demoBeneficiaries,
  demoCards,
  demoGlobalAccounts,
  demoHoldings,
  demoLedger,
  demoLimitOrders,
  demoNotifications,
  demoPaymentLinks,
  demoWatchlist,
  supportTickets,
  users,
  verificationCases,
} from "../db/schema";
import { CaseStatus, DemoCore, LedgerRow, parse } from "./core";
import {
  CRYPTO,
  DAILY_TRADE_LIMIT_USD,
  DAILY_TRANSFER_LIMIT_USD,
  FIAT,
  UNIT,
  WEALTH,
  orderBook,
  sampleRandom,
  series,
  toUnits,
  usdCentsOf,
} from "./market";
import { MoneyService } from "./money";

const TYPES = [
  "buy",
  "sell",
  "swap",
  "transfer",
  "bill",
  "deposit",
  "withdrawal",
  "convert",
  "card_spend",
  "invest",
] as const;
const STATUSES = ["completed", "pending", "failed", "reversed"] as const;

const file = z.strictObject({
  name: z.string().trim().min(1).max(120),
  type: z.string().max(80),
  size: z
    .number()
    .int()
    .min(1)
    .max(15 * 1024 * 1024),
});
const kycSchema = z.strictObject({
  document: z.strictObject({
    type: z.enum(["passport", "national_id", "drivers_licence"]),
    country: z.string().trim().min(2).max(60),
    number: z.string().trim().min(4).max(30),
    file,
  }),
  selfie: z.strictObject({ method: z.literal("sample") }),
  questionnaire: z.strictObject({
    occupation: z.string().trim().min(2).max(80),
    sourceOfFunds: z.enum([
      "salary",
      "business",
      "savings",
      "investments",
      "other",
    ]),
    purpose: z.enum(["payments", "trading", "investing", "all"]),
    politicallyExposed: z.boolean(),
  }),
});
const kybSchema = z.strictObject({
  company: z.strictObject({
    name: z.string().trim().min(2).max(120),
    registrationNumber: z.string().trim().min(3).max(40),
    country: z.string().trim().min(2).max(60),
    incorporatedOn: z.iso.date(),
    address: z.string().trim().min(5).max(200),
  }),
  people: z
    .array(
      z.strictObject({
        name: z.string().trim().min(2).max(120),
        role: z.enum(["director", "owner", "director_owner"]),
        ownership: z.number().min(0).max(100),
      }),
    )
    .min(1)
    .max(8)
    .refine(
      (people) => people.reduce((sum, p) => sum + p.ownership, 0) <= 100,
      "Ownership cannot add up to more than 100%.",
    ),
  documents: z.strictObject({ incorporation: file, address: file }),
  profile: z.strictObject({
    industry: z.string().trim().min(2).max(80),
    monthlyVolume: z.enum(["under_10k", "10k_100k", "100k_1m", "over_1m"]),
    sourceOfFunds: z.string().trim().min(2).max(120),
  }),
});
const kycSteps = ["document", "selfie", "questionnaire"] as const;
const kybSteps = ["company", "people", "documents", "profile"] as const;

const maskNumber = (value: string) =>
  value.length <= 4 ? "••••" : `•••• ${value.slice(-4)}`;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

@Injectable()
export class RecordsService {
  constructor(
    @Inject(DemoCore) private readonly core: DemoCore,
    @Inject(MoneyService) private readonly money: MoneyService,
  ) {}

  private get db() {
    return this.core.db;
  }

  /* ---------- state and overview ---------- */

  async state(userId: string) {
    const profile = await this.core.profile(userId);
    await this.core.settle(userId);
    const [cases, unread, user] = await Promise.all([
      this.core.cases(this.db, userId),
      this.db
        .select({ value: count() })
        .from(demoNotifications)
        .where(
          and(
            eq(demoNotifications.userId, userId),
            isNull(demoNotifications.readAt),
          ),
        ),
      this.db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);
    const view = (row?: typeof verificationCases.$inferSelect) =>
      row
        ? {
            status: row.status as CaseStatus,
            note: row.note,
            submittedAt: row.submittedAt,
          }
        : null;
    return {
      label: "DEMO DATA",
      user: user[0],
      profile: {
        accountType: profile.accountType,
        businessName: profile.businessName,
        referralCode: profile.referralCode,
        mfaEnabled: profile.mfaEnabled,
        notify: profile.notify,
      },
      verification: { kyc: view(cases.kyc), kyb: view(cases.kyb) },
      unread: unread[0]?.value ?? 0,
    };
  }

  async holdingsView(userId: string) {
    const rows = await this.db
      .select()
      .from(demoHoldings)
      .where(eq(demoHoldings.userId, userId));
    return rows
      .filter((row) => row.units > 0)
      .map((row) => ({
        asset: row.asset,
        quantity: row.units / UNIT,
        usd: usdCentsOf(row.asset, row.units) / 100,
        kind: (FIAT as readonly string[]).includes(row.asset)
          ? "cash"
          : WEALTH.some((p) => p.id === row.asset)
            ? "investment"
            : "digital",
      }));
  }

  private async usage(userId: string, types: string[]) {
    const rows = await this.db
      .select({ total: sql<string>`coalesce(sum(${demoLedger.usdCents}), 0)` })
      .from(demoLedger)
      .where(
        and(
          eq(demoLedger.userId, userId),
          inArray(demoLedger.type, types),
          ne(demoLedger.status, "failed"),
          gte(demoLedger.createdAt, new Date(Date.now() - 864e5)),
        ),
      );
    return Number(rows[0]?.total ?? 0) / 100;
  }

  async overview(userId: string) {
    const state = await this.state(userId);
    const [holdings, recent, watch, pending, accounts, trading, transfers] =
      await Promise.all([
        this.holdingsView(userId),
        this.db
          .select()
          .from(demoLedger)
          .where(eq(demoLedger.userId, userId))
          .orderBy(desc(demoLedger.createdAt))
          .limit(5),
        this.db
          .select()
          .from(demoWatchlist)
          .where(eq(demoWatchlist.userId, userId)),
        this.db
          .select({ value: count() })
          .from(demoLedger)
          .where(
            and(
              eq(demoLedger.userId, userId),
              eq(demoLedger.status, "pending"),
            ),
          ),
        this.money.accounts(userId),
        this.usage(userId, ["buy", "sell", "swap"]),
        this.usage(userId, ["transfer", "bill", "withdrawal"]),
      ]);
    return {
      ...state,
      holdings,
      totalUsd: holdings.reduce((sum, h) => sum + h.usd, 0),
      recent: recent.map((row) => this.view(row)),
      watchlist: watch.map((w) => w.symbol),
      pending: pending[0]?.value ?? 0,
      accounts,
      limits: {
        trading: { used: trading, max: DAILY_TRADE_LIMIT_USD },
        transfers: { used: transfers, max: DAILY_TRANSFER_LIMIT_USD },
      },
    };
  }

  async markets(userId: string, symbol?: string, points = 60) {
    const watch = await this.db
      .select()
      .from(demoWatchlist)
      .where(eq(demoWatchlist.userId, userId));
    const selected = CRYPTO.find((a) => a.symbol === symbol) ?? CRYPTO[0];
    const safePoints = [24, 60, 120].includes(points) ? points : 60;
    return {
      label: "ILLUSTRATIVE PRICES",
      asOf: "Fixed demo prices, not market quotes",
      assets: CRYPTO.map((asset) => ({
        ...asset,
        watching: watch.some((w) => w.symbol === asset.symbol),
      })),
      selected: {
        ...selected,
        series: series(selected.symbol, safePoints),
        ...orderBook(selected.symbol),
      },
      orders: (await this.money.orders(userId)).map((order) => ({
        ...order,
        quantity: order.units / UNIT,
      })),
    };
  }

  /* ---------- transactions ---------- */

  view(row: LedgerRow) {
    const amount =
      row.debitAsset && row.debitUnits
        ? { asset: row.debitAsset, value: row.debitUnits / UNIT, sign: -1 }
        : {
            asset: row.creditAsset!,
            value: (row.creditUnits ?? 0) / UNIT,
            sign: 1,
          };
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      reference: row.reference,
      providerRef: row.providerRef,
      status: row.status,
      reason: row.reason,
      currency: row.currency,
      usd: row.usdCents / 100,
      amount,
      debit: row.debitAsset
        ? { asset: row.debitAsset, value: (row.debitUnits ?? 0) / UNIT }
        : null,
      credit: row.creditAsset
        ? { asset: row.creditAsset, value: (row.creditUnits ?? 0) / UNIT }
        : null,
      fee: row.feeAsset
        ? { asset: row.feeAsset, value: row.feeUnits / UNIT }
        : null,
      meta: row.meta ?? {},
      createdAt: row.createdAt,
    };
  }

  private filters(userId: string, query: Record<string, unknown>) {
    const input = parse(
      z.object({
        q: z.string().trim().max(80).optional(),
        type: z.enum(TYPES).optional(),
        status: z.enum(STATUSES).optional(),
        currency: z.enum(FIAT).optional(),
        sort: z.enum(["date", "amount"]).default("date"),
        dir: z.enum(["asc", "desc"]).default("desc"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      }),
      Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== ""),
      ),
    );
    const where: SQL[] = [eq(demoLedger.userId, userId)];
    if (input.q) {
      const like = `%${input.q.replace(/[%_\\]/g, "\\$&")}%`;
      where.push(
        or(
          ilike(demoLedger.description, like),
          ilike(demoLedger.reference, like),
        )!,
      );
    }
    if (input.type) where.push(eq(demoLedger.type, input.type));
    if (input.status) where.push(eq(demoLedger.status, input.status));
    if (input.currency) where.push(eq(demoLedger.currency, input.currency));
    const column =
      input.sort === "amount" ? demoLedger.usdCents : demoLedger.createdAt;
    return {
      input,
      where: and(...where),
      order: input.dir === "asc" ? asc(column) : desc(column),
    };
  }

  async transactions(userId: string, query: Record<string, unknown>) {
    await this.core.settle(userId);
    const { input, where, order } = this.filters(userId, query);
    const perPage = 10;
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(demoLedger)
        .where(where)
        .orderBy(order, desc(demoLedger.id))
        .limit(perPage)
        .offset((input.page - 1) * perPage),
      this.db.select({ value: count() }).from(demoLedger).where(where),
    ]);
    const all = await this.db
      .select({ value: count() })
      .from(demoLedger)
      .where(eq(demoLedger.userId, userId));
    return {
      rows: rows.map((row) => this.view(row)),
      total: total[0]?.value ?? 0,
      everything: all[0]?.value ?? 0,
      page: input.page,
      pages: Math.max(1, Math.ceil((total[0]?.value ?? 0) / perPage)),
    };
  }

  async transaction(userId: string, id: string) {
    await this.core.settle(userId);
    const rows = await this.db
      .select()
      .from(demoLedger)
      .where(
        and(
          eq(demoLedger.id, parse(z.uuid(), id)),
          eq(demoLedger.userId, userId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException("Transaction not found");
    return this.view(rows[0]);
  }

  async csv(userId: string, query: Record<string, unknown>) {
    const { where, order } = this.filters(userId, query);
    const rows = await this.db
      .select()
      .from(demoLedger)
      .where(where)
      .orderBy(order)
      .limit(5000);
    const header = [
      "Date",
      "Reference",
      "Type",
      "Description",
      "Debit",
      "Credit",
      "Fee",
      "USD value",
      "Status",
      "Reason",
    ];
    const line = (row: LedgerRow) =>
      [
        row.createdAt.toISOString(),
        row.reference,
        row.type,
        row.description,
        row.debitAsset
          ? `${(row.debitUnits ?? 0) / UNIT} ${row.debitAsset}`
          : "",
        row.creditAsset
          ? `${(row.creditUnits ?? 0) / UNIT} ${row.creditAsset}`
          : "",
        row.feeAsset ? `${row.feeUnits / UNIT} ${row.feeAsset}` : "",
        (row.usdCents / 100).toFixed(2),
        row.status,
        row.reason ?? "",
      ]
        .map(csvCell)
        .join(",");
    return [
      "# TurboXGlobal investor preview. Simulated data with no monetary value.",
      header.join(","),
      ...rows.map(line),
    ].join("\n");
  }

  /* ---------- statements ---------- */

  async statementPeriods(userId: string) {
    const rows = await this.db
      .select({
        period: sql<string>`to_char(${demoLedger.createdAt} at time zone 'UTC', 'YYYY-MM')`,
      })
      .from(demoLedger)
      .where(eq(demoLedger.userId, userId))
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`);
    return rows.map((row) => row.period);
  }

  async statement(
    userId: string,
    period: string,
    query: Record<string, unknown>,
  ) {
    const input = parse(
      z.object({
        period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month."),
        account: z.enum([...FIAT, "ALL"]).default("ALL"),
        format: z.enum(["csv", "html"]).default("html"),
      }),
      { ...query, period },
    );
    await this.core.settle(userId);
    const start = new Date(`${input.period}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const currencies =
      input.account === "ALL"
        ? [...FIAT]
        : [input.account as (typeof FIAT)[number]];
    const rows = await this.db
      .select()
      .from(demoLedger)
      .where(
        and(
          eq(demoLedger.userId, userId),
          lt(demoLedger.createdAt, end),
          inArray(demoLedger.status, ["completed", "pending"]),
        ),
      )
      .orderBy(asc(demoLedger.createdAt));
    const effect = (row: LedgerRow, currency: string) => {
      let units = 0;
      if (row.debitAsset === currency) units -= row.debitUnits ?? 0;
      const credited = row.status === "completed" || row.type !== "deposit";
      if (credited && row.creditAsset === currency)
        units += row.creditUnits ?? 0;
      return units;
    };
    const user = await this.db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const sections = currencies.map((currency) => {
      const before = rows.filter((r) => r.createdAt < start);
      const during = rows.filter(
        (r) => r.createdAt >= start && effect(r, currency) !== 0,
      );
      const opening = before.reduce((sum, r) => sum + effect(r, currency), 0);
      let running = opening;
      const lines = during.map((r) => {
        running += effect(r, currency);
        return {
          date: r.createdAt.toISOString().slice(0, 10),
          reference: r.reference,
          description: r.description,
          amount: effect(r, currency) / UNIT,
          balance: running / UNIT,
          status: r.status,
        };
      });
      return {
        currency,
        opening: opening / UNIT,
        closing: running / UNIT,
        lines,
      };
    });
    const name = `turboxglobal-statement-${input.period}-${input.account}.${input.format}`;
    if (input.format === "csv") {
      const body = [
        "# TurboXGlobal investor preview statement. Simulated data with no monetary value.",
        "Currency,Date,Reference,Description,Amount,Balance,Status",
        ...sections.flatMap((s) => [
          [
            s.currency,
            `${input.period}-01`,
            "",
            "Opening balance",
            "",
            s.opening.toFixed(2),
            "",
          ]
            .map(csvCell)
            .join(","),
          ...s.lines.map((l) =>
            [
              s.currency,
              l.date,
              l.reference,
              l.description,
              l.amount.toFixed(2),
              l.balance.toFixed(2),
              l.status,
            ]
              .map(csvCell)
              .join(","),
          ),
          [s.currency, "", "", "Closing balance", "", s.closing.toFixed(2), ""]
            .map(csvCell)
            .join(","),
        ]),
      ].join("\n");
      return { name, type: "text/csv; charset=utf-8", body };
    }
    const money = (value: number, currency: string) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        value,
      );
    const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Statement ${input.period}</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#0b1533;max-width:860px;margin:32px auto;padding:0 16px}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin:12px 0 28px}th,td{padding:7px 10px;border-bottom:1px solid #e1e5ee;text-align:left}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.demo{background:#fbf1dc;border-left:4px solid #e8b547;padding:10px 14px;border-radius:6px}@media print{.noprint{display:none}}</style></head><body>
<p class="demo"><b>Investor preview.</b> This statement shows simulated data with no monetary value. It is not a bank statement.</p>
<h1>TurboXGlobal statement · ${escapeHtml(input.period)}</h1><p>Account holder: ${escapeHtml(user[0]?.fullName ?? "")}<br>Accounts: ${escapeHtml(input.account === "ALL" ? "All currencies" : input.account)}</p>
<p class="noprint"><button onclick="print()">Print or save as PDF</button></p>
${sections
  .map(
    (
      s,
    ) => `<h2>${s.currency}</h2><table><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th class="n">Amount</th><th class="n">Balance</th></tr></thead><tbody>
<tr><td>${input.period}-01</td><td></td><td>Opening balance</td><td></td><td class="n">${money(s.opening, s.currency)}</td></tr>
${s.lines.map((l) => `<tr><td>${l.date}</td><td>${escapeHtml(l.reference)}</td><td>${escapeHtml(l.description)}${l.status === "pending" ? " (pending)" : ""}</td><td class="n">${money(l.amount, s.currency)}</td><td class="n">${money(l.balance, s.currency)}</td></tr>`).join("")}
<tr><td></td><td></td><td><b>Closing balance</b></td><td></td><td class="n"><b>${money(s.closing, s.currency)}</b></td></tr></tbody></table>`,
  )
  .join("")}
</body></html>`;
    return { name, type: "text/html; charset=utf-8", body };
  }

  /* ---------- notifications, referrals, tickets ---------- */

  notifications(userId: string) {
    return this.db
      .select()
      .from(demoNotifications)
      .where(eq(demoNotifications.userId, userId))
      .orderBy(desc(demoNotifications.createdAt))
      .limit(100);
  }

  async readNotification(userId: string, id?: string) {
    await this.db
      .update(demoNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(demoNotifications.userId, userId),
          isNull(demoNotifications.readAt),
          ...(id ? [eq(demoNotifications.id, parse(z.uuid(), id))] : []),
        ),
      );
    return { read: true };
  }

  async referrals(userId: string) {
    const profile = await this.core.profile(userId);
    return {
      code: profile.referralCode,
      sample: true,
      stats: { invited: 4, qualified: 2, earnedUsd: 40 },
      history: [
        { friend: "Liam B.", status: "Completed", rewardUsd: 20 },
        { friend: "Sofia M.", status: "Completed", rewardUsd: 20 },
        { friend: "Noah T.", status: "In Review", rewardUsd: null },
        { friend: "Priya N.", status: "Not Started", rewardUsd: null },
      ],
    };
  }

  tickets(userId: string) {
    return this.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async createTicket(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({
        subject: z.string().trim().min(3, "Enter a subject.").max(120),
        body: z.string().trim().min(5, "Describe the issue.").max(4000),
      }),
      body,
    );
    const existing = await this.db
      .select({ value: count() })
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId));
    const rows = await this.db
      .insert(supportTickets)
      .values({ userId, number: 101 + (existing[0]?.value ?? 0), ...input })
      .returning();
    await this.core.notify(
      this.db,
      userId,
      "Account",
      `Ticket T-${rows[0].number} received. Demo tickets are not monitored by staff.`,
    );
    return rows[0];
  }

  /* ---------- verification ---------- */

  async verification(userId: string) {
    await this.core.profile(userId);
    const cases = await this.core.cases(this.db, userId);
    return { kyc: cases.kyc ?? null, kyb: cases.kyb ?? null };
  }

  async saveStep(userId: string, kind: string, step: string, body: unknown) {
    const safeKind = parse(z.enum(["kyc", "kyb"]), kind);
    const steps: readonly string[] = safeKind === "kyc" ? kycSteps : kybSteps;
    if (!steps.includes(step)) throw new NotFoundException("Unknown step");
    const shape = (safeKind === "kyc" ? kycSchema : kybSchema).shape as Record<
      string,
      z.ZodType
    >;
    let value = parse(shape[step], body) as Record<string, unknown>;
    if (safeKind === "kyc" && step === "document") {
      const document = value as z.infer<typeof kycSchema>["document"];
      value = { ...document, number: maskNumber(document.number) };
    }
    const cases = await this.core.cases(this.db, userId);
    const current = cases[safeKind];
    if (!current)
      throw new BadRequestException("Switch to a business account first.");
    if (["in_review", "verified"].includes(current.status))
      throw new BadRequestException("This verification is already submitted.");
    await this.db
      .update(verificationCases)
      .set({ data: { ...current.data, [step]: value } })
      .where(eq(verificationCases.id, current.id));
    return { saved: step };
  }

  async submit(userId: string, kind: string) {
    const safeKind = parse(z.enum(["kyc", "kyb"]), kind);
    const cases = await this.core.cases(this.db, userId);
    const current = cases[safeKind];
    if (!current)
      throw new BadRequestException("Switch to a business account first.");
    if (["in_review", "verified"].includes(current.status))
      throw new BadRequestException("This verification is already submitted.");
    const steps: readonly string[] = safeKind === "kyc" ? kycSteps : kybSteps;
    const missing = steps.filter((step) => !(step in current.data));
    if (missing.length)
      throw new BadRequestException(
        `Complete every step first (missing: ${missing.join(", ")}).`,
      );
    await this.db
      .update(verificationCases)
      .set({ status: "in_review", submittedAt: new Date(), note: null })
      .where(eq(verificationCases.id, current.id));
    await this.core.notify(
      this.db,
      userId,
      "Account",
      safeKind === "kyc"
        ? "Identity verification submitted and in review."
        : "Business verification submitted and in review.",
    );
    return { status: "in_review" };
  }

  /** Investor-demo reviewer control: decides the signed-in user's own case. */
  async review(userId: string, kind: string, body: unknown) {
    const safeKind = parse(z.enum(["kyc", "kyb"]), kind);
    const input = parse(
      z.strictObject({
        decision: z.enum(["verified", "action_required", "rejected"]),
        note: z.string().trim().max(300).optional(),
      }),
      body,
    );
    if (input.decision !== "verified" && !input.note)
      throw new BadRequestException("Add a note explaining the decision.");
    await this.core.profile(userId);
    return this.db.transaction(async (tx) => {
      const profile = await this.core.lock(tx, userId);
      const cases = await this.core.cases(tx, userId);
      const current = cases[safeKind];
      if (!current || current.status !== "in_review")
        throw new BadRequestException("Only a case in review can be decided.");
      await tx
        .update(verificationCases)
        .set({
          status: input.decision,
          note: input.note ?? null,
          decidedAt: new Date(),
        })
        .where(eq(verificationCases.id, current.id));
      const label = safeKind === "kyc" ? "Identity" : "Business";
      await this.core.notify(
        tx,
        userId,
        "Account",
        input.decision === "verified"
          ? `${label} verification approved.`
          : input.decision === "action_required"
            ? `${label} verification needs more information: ${input.note}`
            : `${label} verification was not approved: ${input.note}`,
      );
      if (
        safeKind === "kyc" &&
        input.decision === "verified" &&
        !profile.fundedAt
      ) {
        await this.money.fund(tx, userId);
        await tx
          .update(accountProfiles)
          .set({ fundedAt: new Date() })
          .where(eq(accountProfiles.userId, userId));
      }
      return { status: input.decision };
    });
  }

  /* ---------- profile ---------- */

  async updateProfile(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({
        accountType: z.enum(["personal", "business"]).optional(),
        businessName: z.string().trim().min(2).max(120).optional(),
        mfa: z
          .strictObject({
            enabled: z.boolean(),
            code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
          })
          .optional(),
        notify: z
          .strictObject({
            email: z.boolean(),
            push: z.boolean(),
            sms: z.boolean(),
            marketing: z.boolean(),
          })
          .optional(),
      }),
      body,
    );
    const profile = await this.core.profile(userId);
    if (
      input.accountType === "business" &&
      !(input.businessName ?? profile.businessName)
    )
      throw new BadRequestException("Enter your business name.");
    await this.db
      .update(accountProfiles)
      .set({
        ...(input.accountType ? { accountType: input.accountType } : {}),
        ...(input.businessName ? { businessName: input.businessName } : {}),
        ...(input.mfa ? { mfaEnabled: input.mfa.enabled } : {}),
        ...(input.notify ? { notify: input.notify } : {}),
      })
      .where(eq(accountProfiles.userId, userId));
    if (input.accountType === "business")
      await this.db
        .insert(verificationCases)
        .values({ userId, kind: "kyb" })
        .onConflictDoNothing();
    if (input.mfa)
      await this.core.notify(
        this.db,
        userId,
        "Security",
        `Multi-factor authentication turned ${input.mfa.enabled ? "on" : "off"} (simulated).`,
      );
    return this.state(userId);
  }

  /* ---------- fiat acquiring ---------- */

  async acquiring(userId: string) {
    await this.core.gate(this.db, userId, "acquiring");
    const [links, keys] = await Promise.all([
      this.db
        .select()
        .from(demoPaymentLinks)
        .where(eq(demoPaymentLinks.userId, userId))
        .orderBy(desc(demoPaymentLinks.createdAt)),
      this.db
        .select({
          id: demoApiKeys.id,
          name: demoApiKeys.name,
          last4: demoApiKeys.last4,
          createdAt: demoApiKeys.createdAt,
        })
        .from(demoApiKeys)
        .where(
          and(eq(demoApiKeys.userId, userId), isNull(demoApiKeys.revokedAt)),
        )
        .orderBy(desc(demoApiKeys.createdAt)),
    ]);
    const random = sampleRandom(userId);
    const day = 864e5;
    const methods = ["Card", "Wallet", "Bank transfer"];
    return {
      sample: true,
      kpis: {
        volumeUsd: 48210,
        successRate: 96.4,
        nextSettlementUsd: 12480.55,
        openDisputes: 1,
      },
      links: links.map((l) => ({ ...l, amount: l.amountCents / 100 })),
      keys,
      payments: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - i * day).toISOString(),
        method: methods[i % 3],
        amountUsd: Math.round(random() * 900 + 20),
        status: i === 3 ? "failed" : i < 2 ? "pending" : "settled",
        reconciled: i >= 2 && i !== 3,
      })),
      settlements: [
        { period: "Sep 2026", gross: 21400, fees: 642, net: 20758 },
        { period: "Aug 2026", gross: 19800, fees: 594, net: 19206 },
      ],
      webhooks: [
        {
          url: "https://shop.example.com/hooks",
          lastDelivery: new Date(Date.now() - 36e5).toISOString(),
          result: "completed",
        },
        {
          url: "https://erp.example.com/txg",
          lastDelivery: new Date(Date.now() - 5 * 36e5).toISOString(),
          result: "failed",
        },
      ],
    };
  }

  async createLink(userId: string, body: unknown) {
    await this.core.gate(this.db, userId, "acquiring");
    const input = parse(
      z.strictObject({
        title: z.string().trim().min(2, "Enter a title.").max(80),
        amount: z.union([z.string(), z.number()]),
        currency: z.enum(FIAT).default("USD"),
      }),
      body,
    );
    const cents = toUnits(input.amount, 2) / (UNIT / 100);
    const rows = await this.db
      .insert(demoPaymentLinks)
      .values({
        userId,
        title: input.title,
        amountCents: cents,
        currency: input.currency,
      })
      .returning();
    return rows[0];
  }

  async createKey(userId: string, body: unknown) {
    await this.core.gate(this.db, userId, "acquiring");
    const input = parse(
      z.strictObject({
        name: z.string().trim().min(2, "Name the key.").max(60),
      }),
      body,
    );
    const key = `txg_demo_${randomBytes(24).toString("base64url")}`;
    const rows = await this.db
      .insert(demoApiKeys)
      .values({
        userId,
        name: input.name,
        last4: key.slice(-4),
        keyHash: createHash("sha256").update(key).digest("hex"),
      })
      .returning({ id: demoApiKeys.id, name: demoApiKeys.name });
    await this.core.notify(
      this.db,
      userId,
      "Security",
      `API key "${input.name}" created. Demo keys cannot call any live service.`,
    );
    return { ...rows[0], key };
  }

  async revokeKey(userId: string, id: string) {
    const rows = await this.db
      .update(demoApiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(demoApiKeys.id, parse(z.uuid(), id)),
          eq(demoApiKeys.userId, userId),
          isNull(demoApiKeys.revokedAt),
        ),
      )
      .returning();
    if (!rows[0]) throw new NotFoundException("Key not found");
    return { revoked: true };
  }

  /* ---------- reset ---------- */

  async reset(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({ verification: z.boolean().default(false) }),
      body ?? {},
    );
    await this.core.profile(userId);
    await this.db.transaction(async (tx) => {
      await this.core.lock(tx, userId);
      for (const table of [
        demoLedger,
        demoHoldings,
        demoLimitOrders,
        demoWatchlist,
        demoBeneficiaries,
        demoGlobalAccounts,
        demoPaymentLinks,
        demoApiKeys,
        demoNotifications,
        demoCards,
      ])
        await tx.delete(table).where(eq(table.userId, userId));
      await tx
        .update(accountProfiles)
        .set({ fundedAt: null })
        .where(eq(accountProfiles.userId, userId));
      if (input.verification) {
        await tx
          .delete(verificationCases)
          .where(eq(verificationCases.userId, userId));
        await tx.insert(verificationCases).values({ userId, kind: "kyc" });
        await tx
          .update(accountProfiles)
          .set({ accountType: "personal", mfaEnabled: false })
          .where(eq(accountProfiles.userId, userId));
      } else {
        const cases = await this.core.cases(tx, userId);
        if (cases.kyc?.status === "verified") {
          await this.money.fund(tx, userId);
          await tx
            .update(accountProfiles)
            .set({ fundedAt: new Date() })
            .where(eq(accountProfiles.userId, userId));
        }
      }
    });
    return { message: "Demo data reset" };
  }
}
