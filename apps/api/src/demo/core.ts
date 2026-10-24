import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { randomInt } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { Database } from "../db/database";
import {
  accountProfiles,
  demoGlobalAccounts,
  demoHoldings,
  demoLedger,
  demoNotifications,
  verificationCases,
} from "../db/schema";

export type Db = Database["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;
export type Profile = typeof accountProfiles.$inferSelect;
export type LedgerRow = typeof demoLedger.$inferSelect;
export type CaseStatus =
  "not_started" | "in_review" | "action_required" | "rejected" | "verified";

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? "Invalid input",
    );
  return parsed.data;
}

export const idempotencyKey = z
  .string({ error: "An Idempotency-Key header is required." })
  .min(8)
  .max(100);

const digits = (length: number) =>
  Array.from({ length }, () => randomInt(10)).join("");
export const newReference = () => `TXG-${digits(8)}`;
export const newProviderRef = () => `SIM-${digits(10)}`;

const blocked: Record<Exclude<CaseStatus, "verified">, string> = {
  not_started: "Verify your identity to use this feature.",
  in_review:
    "Your verification is in review. This unlocks as soon as it is approved.",
  action_required: "We need more information to finish your verification.",
  rejected: "Your verification was not approved. Review the note and resubmit.",
};
const blockedBusiness: Record<Exclude<CaseStatus, "verified">, string> = {
  not_started: "Verify your business to use Fiat Acquiring.",
  in_review:
    "Your business verification is in review. Fiat Acquiring unlocks once it is approved.",
  action_required:
    "We need more information to finish your business verification.",
  rejected:
    "Your business verification was not approved. Review the note and resubmit.",
};

@Injectable()
export class DemoCore {
  constructor(@Inject(Database) readonly database: Database) {}

  get db() {
    return this.database.db;
  }

  /** Create the profile and KYC case lazily so existing accounts work too. */
  async profile(userId: string): Promise<Profile> {
    const rows = await this.db
      .select()
      .from(accountProfiles)
      .where(eq(accountProfiles.userId, userId))
      .limit(1);
    if (rows[0]) return rows[0];
    await this.db
      .insert(accountProfiles)
      .values({
        userId,
        referralCode: `TURBO-${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      })
      .onConflictDoNothing();
    await this.db
      .insert(verificationCases)
      .values({ userId, kind: "kyc" })
      .onConflictDoNothing();
    const created = await this.db
      .select()
      .from(accountProfiles)
      .where(eq(accountProfiles.userId, userId))
      .limit(1);
    return created[0];
  }

  /** Serialize every balance-changing action for one user. */
  async lock(tx: Tx, userId: string): Promise<Profile> {
    const rows = await tx
      .select()
      .from(accountProfiles)
      .where(eq(accountProfiles.userId, userId))
      .for("update");
    if (!rows[0]) throw new BadRequestException("Demo account unavailable");
    return rows[0];
  }

  /** Run a balance-changing action once per idempotency key. */
  async action<T>(
    userId: string,
    key: string | undefined,
    run: (tx: Tx, profile: Profile) => Promise<T>,
  ): Promise<T | { duplicate: true; transaction: LedgerRow }> {
    const safeKey = parse(idempotencyKey, key);
    await this.profile(userId);
    return this.db.transaction(async (tx) => {
      const profile = await this.lock(tx, userId);
      const previous = await tx
        .select()
        .from(demoLedger)
        .where(
          and(
            eq(demoLedger.userId, userId),
            eq(demoLedger.idempotencyKey, safeKey),
          ),
        )
        .limit(1);
      if (previous[0])
        return { duplicate: true as const, transaction: previous[0] };
      return run(tx, profile);
    });
  }

  async cases(executor: Executor, userId: string) {
    const rows = await executor
      .select()
      .from(verificationCases)
      .where(eq(verificationCases.userId, userId));
    return {
      kyc: rows.find((row) => row.kind === "kyc"),
      kyb: rows.find((row) => row.kind === "kyb"),
    };
  }

  /** Throw the reference gate message unless the product is unlocked. */
  async gate(
    executor: Executor,
    userId: string,
    product: "personal" | "acquiring" = "personal",
  ) {
    const { kyc, kyb } = await this.cases(executor, userId);
    const status = (kyc?.status ?? "not_started") as CaseStatus;
    if (status !== "verified") throw new ForbiddenException(blocked[status]);
    if (product === "acquiring") {
      const profile = await this.profile(userId);
      if (profile.accountType !== "business")
        throw new ForbiddenException(
          "Fiat Acquiring is available to business accounts only.",
        );
      const businessStatus = (kyb?.status ?? "not_started") as CaseStatus;
      if (businessStatus !== "verified")
        throw new ForbiddenException(blockedBusiness[businessStatus]);
    }
  }

  async holdings(executor: Executor, userId: string) {
    const rows = await executor
      .select()
      .from(demoHoldings)
      .where(eq(demoHoldings.userId, userId));
    return Object.fromEntries(rows.map((row) => [row.asset, row.units]));
  }

  async balance(tx: Tx, userId: string, asset: string) {
    const rows = await tx
      .select()
      .from(demoHoldings)
      .where(
        and(eq(demoHoldings.userId, userId), eq(demoHoldings.asset, asset)),
      )
      .limit(1);
    return rows[0]?.units ?? 0;
  }

  /** Adjust a balance inside a locked transaction; never below zero. */
  async adjust(tx: Tx, userId: string, asset: string, delta: number) {
    if (delta < 0 && (await this.balance(tx, userId, asset)) < -delta)
      throw new BadRequestException(`Insufficient ${asset} balance.`);
    await tx
      .insert(demoHoldings)
      .values({ userId, asset, units: delta })
      .onConflictDoUpdate({
        target: [demoHoldings.userId, demoHoldings.asset],
        set: { units: sql`${demoHoldings.units} + ${delta}` },
      });
  }

  async record(
    tx: Tx,
    values: Omit<
      typeof demoLedger.$inferInsert,
      "reference" | "providerRef" | "id" | "createdAt"
    >,
  ) {
    const rows = await tx
      .insert(demoLedger)
      .values({
        ...values,
        reference: newReference(),
        providerRef: newProviderRef(),
      })
      .returning();
    return rows[0];
  }

  notify(
    executor: Executor,
    userId: string,
    category: "Account" | "Payments" | "Security",
    message: string,
  ) {
    return executor
      .insert(demoNotifications)
      .values({ userId, category, message: message.slice(0, 500) });
  }

  /** Settle pending items whose simulated processing time has passed. */
  async settle(userId: string) {
    const now = new Date();
    await this.db
      .update(demoGlobalAccounts)
      .set({ status: "active" })
      .where(
        and(
          eq(demoGlobalAccounts.userId, userId),
          eq(demoGlobalAccounts.status, "provisioning"),
          lte(demoGlobalAccounts.readyAt, now),
        ),
      );
    const due = await this.db
      .select({ id: demoLedger.id })
      .from(demoLedger)
      .where(
        and(
          eq(demoLedger.userId, userId),
          eq(demoLedger.status, "pending"),
          lte(demoLedger.settleAt, now),
        ),
      )
      .limit(1);
    if (!due[0]) return;
    await this.profile(userId);
    await this.db.transaction(async (tx) => {
      await this.lock(tx, userId);
      const rows = await tx
        .select()
        .from(demoLedger)
        .where(
          and(
            eq(demoLedger.userId, userId),
            eq(demoLedger.status, "pending"),
            lte(demoLedger.settleAt, now),
          ),
        );
      for (const row of rows) {
        if (row.type === "deposit" && row.creditAsset && row.creditUnits)
          await this.adjust(tx, userId, row.creditAsset, row.creditUnits);
        await tx
          .update(demoLedger)
          .set({ status: "completed" })
          .where(eq(demoLedger.id, row.id));
        if (["transfer", "bill", "deposit", "withdrawal"].includes(row.type))
          await this.notify(
            tx,
            userId,
            "Payments",
            `${row.description}: completed.`,
          );
      }
    });
  }
}
