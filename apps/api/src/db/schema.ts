import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
  isAdmin: boolean("is_admin").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at", {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authenticationSessions = pgTable("authentication_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailUpdates: boolean("email_updates").notNull().default(false),
  demoAutoSave: boolean("demo_auto_save").notNull().default(false),
});

export const demoBalances = pgTable("demo_balances", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  cashMinor: integer("cash_minor").notNull().default(10000000),
  savingsMinor: integer("savings_minor").notNull().default(0),
  investmentMinor: integer("investment_minor").notNull().default(0),
  points: integer("points").notNull().default(0),
  lastCheckIn: timestamp("last_check_in", { withTimezone: true }),
});

export const demoTransactions = pgTable(
  "demo_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    description: varchar("description", { length: 160 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("demo_transaction_idempotency_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
  ],
);

export const demoSavingsGoals = pgTable("demo_savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  targetMinor: integer("target_minor").notNull(),
  savedMinor: integer("saved_minor").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const demoOrders = pgTable("demo_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 32 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const demoCards = pgTable("demo_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 80 }).notNull(),
  frozen: boolean("frozen").notNull().default(false),
  limitMinor: integer("limit_minor").notNull().default(1000000),
  last4: varchar("last4", { length: 4 }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const demoNotifications = pgTable("demo_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  category: varchar("category", { length: 20 }).notNull().default("Account"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
/** Quantities of every asset are stored as integer units of 1e-8. */
const units = (name: string) => bigint(name, { mode: "number" });

export const accountProfiles = pgTable("account_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accountType: varchar("account_type", { length: 12 })
    .notNull()
    .default("personal"),
  businessName: varchar("business_name", { length: 120 }),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  notify: jsonb("notify")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({ email: true, push: true, sms: false, marketing: false }),
  fundedAt: timestamp("funded_at", { withTimezone: true }),
  createdAt: created(),
});

export const demoHoldings = pgTable(
  "demo_holdings",
  {
    userId: owner(),
    asset: varchar("asset", { length: 8 }).notNull(),
    units: units("units").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.asset] })],
);

export const demoLedger = pgTable(
  "demo_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    type: varchar("type", { length: 20 }).notNull(),
    /** What left the user's balances (fee included), if anything. */
    debitAsset: varchar("debit_asset", { length: 8 }),
    debitUnits: units("debit_units"),
    /** What arrived in the user's balances (fee already deducted), if anything. */
    creditAsset: varchar("credit_asset", { length: 8 }),
    creditUnits: units("credit_units"),
    feeAsset: varchar("fee_asset", { length: 8 }),
    feeUnits: units("fee_units").notNull().default(0),
    /** Fiat currency used for filters and statements. */
    currency: varchar("currency", { length: 3 }).notNull(),
    usdCents: units("usd_cents").notNull(),
    cardId: uuid("card_id"),
    meta: jsonb("meta").$type<Record<string, string>>(),
    description: varchar("description", { length: 160 }).notNull(),
    reference: varchar("reference", { length: 20 }).notNull(),
    providerRef: varchar("provider_ref", { length: 24 }).notNull(),
    status: varchar("status", { length: 12 }).notNull(),
    reason: varchar("reason", { length: 200 }),
    settleAt: timestamp("settle_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    createdAt: created(),
  },
  (table) => [
    uniqueIndex("demo_ledger_idempotency_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
    index("demo_ledger_user_created").on(table.userId, table.createdAt),
  ],
);

export const demoLimitOrders = pgTable("demo_limit_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  symbol: varchar("symbol", { length: 8 }).notNull(),
  side: varchar("side", { length: 4 }).notNull(),
  units: units("units").notNull(),
  limitPrice: doublePrecision("limit_price").notNull(),
  status: varchar("status", { length: 12 }).notNull().default("open"),
  createdAt: created(),
});

export const demoWatchlist = pgTable(
  "demo_watchlist",
  {
    userId: owner(),
    symbol: varchar("symbol", { length: 8 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.symbol] })],
);

export const demoBeneficiaries = pgTable("demo_beneficiaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  kind: varchar("kind", { length: 8 }).notNull().default("person"),
  name: varchar("name", { length: 120 }).notNull(),
  country: varchar("country", { length: 60 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  accountLast4: varchar("account_last4", { length: 4 }).notNull(),
  createdAt: created(),
});

export const demoGlobalAccounts = pgTable(
  "demo_global_accounts",
  {
    userId: owner(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 12 }).notNull(),
    accountNumber: varchar("account_number", { length: 34 }).notNull(),
    routing: varchar("routing", { length: 20 }).notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.currency] })],
);

export const verificationCases = pgTable(
  "verification_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    kind: varchar("kind", { length: 3 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("not_started"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    note: varchar("note", { length: 300 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: created(),
  },
  (table) => [
    uniqueIndex("verification_user_kind").on(table.userId, table.kind),
  ],
);

export const demoPaymentLinks = pgTable("demo_payment_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  title: varchar("title", { length: 80 }).notNull(),
  amountCents: units("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 12 }).notNull().default("open"),
  createdAt: created(),
});

export const demoApiKeys = pgTable("demo_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  name: varchar("name", { length: 60 }).notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: created(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  number: integer("number").notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 12 }).notNull().default("open"),
  createdAt: created(),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  topic: varchar("topic", { length: 40 }).notNull(),
  message: text("message").notNull(),
  createdAt: created(),
});
