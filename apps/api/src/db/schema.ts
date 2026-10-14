import {
  boolean,
  integer,
  pgTable,
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
