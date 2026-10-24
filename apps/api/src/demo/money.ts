import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  demoBeneficiaries,
  demoCards,
  demoGlobalAccounts,
  demoLedger,
  demoLimitOrders,
  demoWatchlist,
} from "../db/schema";
import { DemoCore, parse, Tx } from "./core";
import {
  CONVERT_FEE,
  CRYPTO,
  DAILY_TRADE_LIMIT_USD,
  DEPOSIT_LIMIT_USD,
  FIAT,
  FX,
  Fiat,
  SINGLE_TRANSFER_LIMIT_USD,
  TRADE_FEE,
  TRANSFER_FEE,
  UNIT,
  WEALTH,
  convertUnits,
  decimalsOf,
  floorTo,
  priceUsd,
  toUnits,
  usdCentsOf,
} from "./market";

const fiat = z.enum(FIAT, { error: "Choose USD, EUR or GBP." });
const crypto = z.enum(
  CRYPTO.map((item) => item.symbol) as [string, ...string[]],
  { error: "Choose a supported asset." },
);
const seconds = (n: number) => new Date(Date.now() + n * 1000);
const OPENING: [string, number][] = [
  ["USD", 12480.55],
  ["EUR", 3200],
  ["GBP", 1850.25],
  ["BTC", 0.0842],
  ["ETH", 1.35],
  ["SOL", 24],
  ["USDT", 500],
];
const MERCHANTS = [
  "Streaming service",
  "Cloud hosting",
  "Online store",
  "Airline tickets",
  "Software subscription",
  "Food delivery",
];

/** Fictitious account details that cannot belong to a real bank account. */
function accountDetails(userId: string, currency: Fiat) {
  const hex = createHash("sha256")
    .update(userId + currency)
    .digest("hex");
  const n = (start: number, length: number) =>
    String(parseInt(hex.slice(start, start + 12), 16)).slice(0, length);
  if (currency === "EUR")
    return {
      accountNumber: `XX00 TXGD ${n(0, 4)} ${n(8, 4)} ${n(16, 4)}`,
      routing: "TXGDXXSIM",
    };
  if (currency === "GBP")
    return { accountNumber: `99${n(0, 6)}`, routing: "00-99-00" };
  return { accountNumber: `9900${n(0, 6)}`, routing: "000000990" };
}

/** A test-range card number that deliberately fails the Luhn check. */
function cardNumber(cardId: string, last4: string) {
  const hex = createHash("sha256").update(cardId).digest("hex");
  const body = `400000${String(parseInt(hex.slice(0, 10), 16))
    .padStart(6, "0")
    .slice(0, 5)}${last4}`;
  const sum = [...body].reverse().reduce((total, char, index) => {
    let digit = Number(char);
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    return total + digit;
  }, 0);
  const valid = (10 - (sum % 10)) % 10;
  const pan = body.slice(0, 15) + String((valid + 1) % 10);
  return {
    pan: pan.replace(/(\d{4})(?=\d)/g, "$1 "),
    expiry: "12/29",
    cvv: String((parseInt(hex.slice(10, 14), 16) % 900) + 100),
  };
}

@Injectable()
export class MoneyService {
  constructor(@Inject(DemoCore) private readonly core: DemoCore) {}

  /** Credit the opening demo balances the first time a profile is approved. */
  async fund(tx: Tx, userId: string) {
    for (const [asset, amount] of OPENING) {
      const units = Math.round(amount * UNIT);
      await this.core.adjust(tx, userId, asset, units);
      await this.core.record(tx, {
        userId,
        type: "deposit",
        creditAsset: asset,
        creditUnits: units,
        currency: FIAT.includes(asset as Fiat) ? asset : "USD",
        usdCents: usdCentsOf(asset, units),
        description: `Opening demo balance (${asset})`,
        status: "completed",
      });
    }
    for (const currency of ["USD", "EUR"] as const)
      await tx
        .insert(demoGlobalAccounts)
        .values({
          userId,
          currency,
          status: "active",
          readyAt: new Date(),
          ...accountDetails(userId, currency),
        })
        .onConflictDoNothing();
    await this.core.notify(
      tx,
      userId,
      "Account",
      "Your demo account is funded with simulated USD, EUR, GBP and digital assets.",
    );
  }

  private async usedToday(tx: Tx, userId: string, types: string[]) {
    const rows = await tx
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
    return Number(rows[0]?.total ?? 0);
  }

  /* ---------- trading ---------- */

  quoteTrade(body: unknown) {
    const input = parse(
      z.discriminatedUnion("side", [
        z.strictObject({
          side: z.enum(["buy", "sell"]),
          symbol: crypto,
          quantity: z.union([z.string(), z.number()]),
        }),
        z.strictObject({
          side: z.literal("swap"),
          from: crypto,
          to: crypto,
          quantity: z.union([z.string(), z.number()]),
        }),
      ]),
      body,
    );
    if (input.side === "swap") {
      if (input.from === input.to)
        throw new BadRequestException("Choose two different assets.");
      const units = toUnits(input.quantity, 8);
      const gross = convertUnits(input.from, input.to, units);
      const fee = floorTo(Math.round(gross * TRADE_FEE), 8);
      return {
        side: "swap" as const,
        from: input.from,
        to: input.to,
        units,
        receiveUnits: gross - fee,
        feeUnits: fee,
        usdCents: usdCentsOf(input.from, units),
      };
    }
    const units = toUnits(input.quantity, 8);
    const notional = usdCentsOf(input.symbol, units);
    const fee = Math.round(notional * TRADE_FEE);
    return {
      side: input.side,
      symbol: input.symbol,
      units,
      price: priceUsd(input.symbol),
      usdCents: notional,
      feeCents: fee,
      totalCents: input.side === "buy" ? notional + fee : notional - fee,
    };
  }

  trade(userId: string, body: unknown, key?: string) {
    const quote = this.quoteTrade(body);
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      if (
        (await this.usedToday(tx, userId, ["buy", "sell", "swap"])) +
          quote.usdCents >
        DAILY_TRADE_LIMIT_USD * 100
      )
        throw new BadRequestException(
          "This would exceed your 10,000 USD daily trading limit.",
        );
      const base = {
        userId,
        idempotencyKey: key,
        status: "pending",
        settleAt: seconds(4),
        currency: "USD",
        usdCents: quote.usdCents,
      };
      if (quote.side === "swap") {
        await this.core.adjust(tx, userId, quote.from, -quote.units);
        await this.core.adjust(tx, userId, quote.to, quote.receiveUnits);
        return this.core.record(tx, {
          ...base,
          type: "swap",
          debitAsset: quote.from,
          debitUnits: quote.units,
          creditAsset: quote.to,
          creditUnits: quote.receiveUnits,
          feeAsset: quote.to,
          feeUnits: quote.feeUnits,
          description: `Swap ${quote.from} to ${quote.to}`,
        });
      }
      const cash = quote.totalCents * (UNIT / 100);
      const fee = quote.feeCents * (UNIT / 100);
      if (quote.side === "buy") {
        await this.core.adjust(tx, userId, "USD", -cash);
        await this.core.adjust(tx, userId, quote.symbol, quote.units);
        return this.core.record(tx, {
          ...base,
          type: "buy",
          debitAsset: "USD",
          debitUnits: cash,
          creditAsset: quote.symbol,
          creditUnits: quote.units,
          feeAsset: "USD",
          feeUnits: fee,
          description: `Bought ${quote.units / UNIT} ${quote.symbol}`,
        });
      }
      await this.core.adjust(tx, userId, quote.symbol, -quote.units);
      await this.core.adjust(tx, userId, "USD", cash);
      return this.core.record(tx, {
        ...base,
        type: "sell",
        debitAsset: quote.symbol,
        debitUnits: quote.units,
        creditAsset: "USD",
        creditUnits: cash,
        feeAsset: "USD",
        feeUnits: fee,
        description: `Sold ${quote.units / UNIT} ${quote.symbol}`,
      });
    });
  }

  orders(userId: string) {
    return this.core.db
      .select()
      .from(demoLimitOrders)
      .where(eq(demoLimitOrders.userId, userId))
      .orderBy(desc(demoLimitOrders.createdAt));
  }

  /** A limit order that already crosses the fixed price executes as a market trade. */
  async limitOrder(userId: string, body: unknown, key?: string) {
    const input = parse(
      z.strictObject({
        side: z.enum(["buy", "sell"]),
        symbol: crypto,
        quantity: z.union([z.string(), z.number()]),
        limitPrice: z.coerce
          .number({ error: "Enter a valid limit price." })
          .positive("Enter a valid limit price.")
          .max(10_000_000),
      }),
      body,
    );
    const price = priceUsd(input.symbol);
    const crosses =
      input.side === "buy"
        ? input.limitPrice >= price
        : input.limitPrice <= price;
    if (crosses) {
      const result = await this.trade(
        userId,
        { side: input.side, symbol: input.symbol, quantity: input.quantity },
        key,
      );
      return { executed: true, result };
    }
    const units = toUnits(input.quantity, 8);
    await this.core.gate(this.core.db, userId);
    const rows = await this.core.db
      .insert(demoLimitOrders)
      .values({
        userId,
        symbol: input.symbol,
        side: input.side,
        units,
        limitPrice: input.limitPrice,
      })
      .returning();
    return { executed: false, order: rows[0] };
  }

  async cancelOrder(userId: string, id: string) {
    const rows = await this.core.db
      .update(demoLimitOrders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(demoLimitOrders.id, id),
          eq(demoLimitOrders.userId, userId),
          eq(demoLimitOrders.status, "open"),
        ),
      )
      .returning();
    if (!rows[0]) throw new NotFoundException("Open order not found");
    return rows[0];
  }

  async toggleWatch(userId: string, symbol: string) {
    const safe = parse(crypto, symbol);
    const removed = await this.core.db
      .delete(demoWatchlist)
      .where(
        and(eq(demoWatchlist.userId, userId), eq(demoWatchlist.symbol, safe)),
      )
      .returning();
    if (!removed.length)
      await this.core.db.insert(demoWatchlist).values({ userId, symbol: safe });
    return { symbol: safe, watching: !removed.length };
  }

  /* ---------- payments ---------- */

  beneficiaries(userId: string) {
    return this.core.db
      .select()
      .from(demoBeneficiaries)
      .where(eq(demoBeneficiaries.userId, userId))
      .orderBy(desc(demoBeneficiaries.createdAt));
  }

  async addBeneficiary(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({
        kind: z.enum(["person", "biller"]).default("person"),
        name: z.string().trim().min(2, "Enter a name.").max(120),
        country: z.string().trim().min(2, "Enter a country.").max(60),
        currency: fiat,
        account: z
          .string()
          .trim()
          .regex(
            /^[A-Za-z0-9 ]{6,34}$/,
            "Enter a valid account number or IBAN.",
          ),
      }),
      body,
    );
    const rows = await this.core.db
      .insert(demoBeneficiaries)
      .values({
        userId,
        kind: input.kind,
        name: input.name,
        country: input.country,
        currency: input.currency,
        accountLast4: input.account.replace(/\s/g, "").slice(-4),
      })
      .returning();
    return rows[0];
  }

  async removeBeneficiary(userId: string, id: string) {
    const rows = await this.core.db
      .delete(demoBeneficiaries)
      .where(
        and(eq(demoBeneficiaries.id, id), eq(demoBeneficiaries.userId, userId)),
      )
      .returning();
    if (!rows[0]) throw new NotFoundException("Beneficiary not found");
    return { removed: true };
  }

  async quotePayment(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({
        kind: z.enum(["transfer", "bill"]),
        beneficiaryId: z.uuid("Choose a beneficiary."),
        currency: fiat,
        amount: z.union([z.string(), z.number()]),
        reference: z.string().trim().max(40).optional(),
      }),
      body,
    );
    const rows = await this.core.db
      .select()
      .from(demoBeneficiaries)
      .where(
        and(
          eq(demoBeneficiaries.id, input.beneficiaryId),
          eq(demoBeneficiaries.userId, userId),
        ),
      )
      .limit(1);
    const beneficiary = rows[0];
    if (!beneficiary) throw new NotFoundException("Beneficiary not found");
    const units = toUnits(input.amount, 2);
    const fee =
      input.kind === "bill"
        ? UNIT
        : Math.max(UNIT, floorTo(Math.round(units * TRANSFER_FEE), 2));
    const to = beneficiary.currency as Fiat;
    const receiveUnits = convertUnits(input.currency, to, units);
    const usdCents = usdCentsOf(input.currency, units);
    return {
      ...input,
      beneficiary,
      units,
      feeUnits: fee,
      rate: FX[input.currency] / FX[to],
      receiveUnits,
      usdCents,
      overLimit: usdCents > SINGLE_TRANSFER_LIMIT_USD * 100,
    };
  }

  async pay(userId: string, body: unknown, key?: string) {
    const quote = await this.quotePayment(userId, body);
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      const label = quote.kind === "bill" ? "Bill" : "Transfer";
      const base = {
        userId,
        idempotencyKey: key,
        type: quote.kind,
        debitAsset: quote.currency,
        debitUnits: quote.units + quote.feeUnits,
        feeAsset: quote.currency,
        feeUnits: quote.feeUnits,
        currency: quote.currency,
        usdCents: quote.usdCents,
        description: `${label} to ${quote.beneficiary.name}`.slice(0, 160),
        meta: {
          beneficiary: quote.beneficiary.name,
          account: `•••• ${quote.beneficiary.accountLast4}`,
          rate: quote.rate.toFixed(4),
          recipientGets: `${(quote.receiveUnits / UNIT).toFixed(2)} ${quote.beneficiary.currency}`,
          ...(quote.reference ? { reference: quote.reference } : {}),
        },
      };
      if (quote.overLimit)
        return this.core.record(tx, {
          ...base,
          status: "failed",
          reason: "Declined: exceeds the 5,000 USD single-transfer limit.",
        });
      await this.core.adjust(
        tx,
        userId,
        quote.currency,
        -(quote.units + quote.feeUnits),
      );
      return this.core.record(tx, {
        ...base,
        status: "pending",
        settleAt: seconds(8),
      });
    });
  }

  /* ---------- global accounts ---------- */

  async accounts(userId: string) {
    const rows = await this.core.db
      .select()
      .from(demoGlobalAccounts)
      .where(eq(demoGlobalAccounts.userId, userId));
    return FIAT.map((currency) => {
      const row = rows.find((item) => item.currency === currency);
      return row
        ? {
            currency,
            status: row.status,
            accountNumber: row.status === "active" ? row.accountNumber : null,
            routing: row.status === "active" ? row.routing : null,
          }
        : { currency, status: "none", accountNumber: null, routing: null };
    });
  }

  async requestAccount(userId: string, currency: string) {
    const safe = parse(fiat, currency);
    await this.core.gate(this.core.db, userId);
    await this.core.db
      .insert(demoGlobalAccounts)
      .values({
        userId,
        currency: safe,
        status: "provisioning",
        readyAt: seconds(45),
        ...accountDetails(userId, safe),
      })
      .onConflictDoNothing();
    await this.core.notify(
      this.core.db,
      userId,
      "Account",
      `${safe} account requested. It will be ready shortly.`,
    );
    return { currency: safe, status: "provisioning" };
  }

  quoteConvert(body: unknown) {
    const input = parse(
      z.strictObject({
        from: fiat,
        to: fiat,
        amount: z.union([z.string(), z.number()]),
      }),
      body,
    );
    if (input.from === input.to)
      throw new BadRequestException("Choose two different currencies.");
    const units = toUnits(input.amount, 2);
    const gross = convertUnits(input.from, input.to, units);
    const fee = floorTo(Math.round(gross * CONVERT_FEE), 2);
    return { ...input, units, feeUnits: fee, receiveUnits: gross - fee };
  }

  convert(userId: string, body: unknown, key?: string) {
    const quote = this.quoteConvert(body);
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      await this.core.adjust(tx, userId, quote.from, -quote.units);
      await this.core.adjust(tx, userId, quote.to, quote.receiveUnits);
      return this.core.record(tx, {
        userId,
        idempotencyKey: key,
        type: "convert",
        debitAsset: quote.from,
        debitUnits: quote.units,
        creditAsset: quote.to,
        creditUnits: quote.receiveUnits,
        feeAsset: quote.to,
        feeUnits: quote.feeUnits,
        currency: quote.from,
        usdCents: usdCentsOf(quote.from, quote.units),
        description: `Convert ${quote.from} to ${quote.to}`,
        status: "completed",
      });
    });
  }

  deposit(userId: string, body: unknown, key?: string) {
    const input = parse(
      z.strictObject({
        currency: fiat,
        amount: z.union([z.string(), z.number()]),
        method: z.enum(["bank", "card"]).default("bank"),
      }),
      body,
    );
    const units = toUnits(input.amount, 2);
    const usdCents = usdCentsOf(input.currency, units);
    if (usdCents > DEPOSIT_LIMIT_USD * 100)
      throw new BadRequestException(
        "Demo deposits are limited to 50,000 USD each.",
      );
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      return this.core.record(tx, {
        userId,
        idempotencyKey: key,
        type: "deposit",
        creditAsset: input.currency,
        creditUnits: units,
        currency: input.currency,
        usdCents,
        description: input.method === "card" ? "Card deposit" : "Bank deposit",
        status: "pending",
        settleAt: seconds(10),
      });
    });
  }

  withdraw(userId: string, body: unknown, key?: string) {
    const input = parse(
      z.strictObject({
        currency: fiat,
        amount: z.union([z.string(), z.number()]),
      }),
      body,
    );
    const units = toUnits(input.amount, 2);
    const usdCents = usdCentsOf(input.currency, units);
    if (usdCents > SINGLE_TRANSFER_LIMIT_USD * 100)
      throw new BadRequestException("Over your 5,000 USD withdrawal limit.");
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      await this.core.adjust(tx, userId, input.currency, -units);
      return this.core.record(tx, {
        userId,
        idempotencyKey: key,
        type: "withdrawal",
        debitAsset: input.currency,
        debitUnits: units,
        currency: input.currency,
        usdCents,
        description: "Withdrawal to bank",
        status: "pending",
        settleAt: seconds(10),
      });
    });
  }

  /* ---------- cards ---------- */

  async cards(userId: string) {
    const cards = await this.core.db
      .select()
      .from(demoCards)
      .where(and(eq(demoCards.userId, userId), isNull(demoCards.cancelledAt)))
      .orderBy(desc(demoCards.createdAt));
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const spend = await this.core.db
      .select({
        cardId: demoLedger.cardId,
        total: sql<string>`coalesce(sum(${demoLedger.usdCents}), 0)`,
      })
      .from(demoLedger)
      .where(
        and(
          eq(demoLedger.userId, userId),
          eq(demoLedger.type, "card_spend"),
          ne(demoLedger.status, "failed"),
          gte(demoLedger.createdAt, month),
        ),
      )
      .groupBy(demoLedger.cardId);
    return cards.map((card) => ({
      id: card.id,
      label: card.label,
      last4: card.last4 ?? "0000",
      frozen: card.frozen,
      limitCents: card.limitMinor,
      spentCents: Number(
        spend.find((row) => row.cardId === card.id)?.total ?? 0,
      ),
      createdAt: card.createdAt,
    }));
  }

  private async card(userId: string, id: string) {
    const rows = await this.core.db
      .select()
      .from(demoCards)
      .where(
        and(
          eq(demoCards.id, id),
          eq(demoCards.userId, userId),
          isNull(demoCards.cancelledAt),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException("Card not found");
    return rows[0];
  }

  async createCard(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({
        label: z.string().trim().min(2, "Name the card.").max(80),
      }),
      body,
    );
    await this.core.gate(this.core.db, userId);
    if ((await this.cards(userId)).length >= 3)
      throw new BadRequestException("You can have up to 3 active demo cards.");
    const rows = await this.core.db
      .insert(demoCards)
      .values({
        userId,
        label: input.label,
        limitMinor: 150000,
        last4: String(randomInt(1000, 10000)),
      })
      .returning();
    await this.core.notify(
      this.core.db,
      userId,
      "Security",
      `Virtual card "${input.label}" created.`,
    );
    return rows[0];
  }

  async updateCard(userId: string, id: string, body: unknown) {
    const input = parse(
      z.strictObject({
        frozen: z.boolean().optional(),
        limitUsd: z
          .number()
          .int("Enter a whole number from 1 to 5,000.")
          .min(1, "Enter a whole number from 1 to 5,000.")
          .max(5000, "Enter a whole number from 1 to 5,000.")
          .optional(),
      }),
      body,
    );
    const card = await this.card(userId, id);
    await this.core.db
      .update(demoCards)
      .set({
        ...(input.frozen === undefined ? {} : { frozen: input.frozen }),
        ...(input.limitUsd === undefined
          ? {}
          : { limitMinor: input.limitUsd * 100 }),
      })
      .where(eq(demoCards.id, card.id));
    if (input.frozen !== undefined)
      await this.core.notify(
        this.core.db,
        userId,
        "Security",
        `Card •••• ${card.last4} ${input.frozen ? "frozen" : "unfrozen"}.`,
      );
    if (input.limitUsd !== undefined)
      await this.core.notify(
        this.core.db,
        userId,
        "Security",
        `Card •••• ${card.last4} monthly limit set to ${input.limitUsd} USD.`,
      );
    return { updated: true };
  }

  async cancelCard(userId: string, id: string) {
    const card = await this.card(userId, id);
    await this.core.db
      .update(demoCards)
      .set({ cancelledAt: new Date(), frozen: true })
      .where(eq(demoCards.id, card.id));
    await this.core.notify(
      this.core.db,
      userId,
      "Security",
      `Card •••• ${card.last4} cancelled.`,
    );
    return { cancelled: true };
  }

  async revealCard(userId: string, id: string, body: unknown) {
    parse(
      z.strictObject({
        code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
      }),
      body,
    );
    const card = await this.card(userId, id);
    await this.core.notify(
      this.core.db,
      userId,
      "Security",
      `Card •••• ${card.last4} details were revealed.`,
    );
    return {
      ...cardNumber(card.id, card.last4 ?? "0000"),
      autoHideSeconds: 30,
    };
  }

  /** Simulate a merchant authorisation against a card. */
  async purchase(userId: string, id: string, key?: string) {
    const card = await this.card(userId, id);
    const merchant = MERCHANTS[randomInt(MERCHANTS.length)];
    const cents = randomInt(500, 12000);
    const units = cents * (UNIT / 100);
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      const month = new Date();
      month.setUTCDate(1);
      month.setUTCHours(0, 0, 0, 0);
      const spent = await tx
        .select({
          total: sql<string>`coalesce(sum(${demoLedger.usdCents}), 0)`,
        })
        .from(demoLedger)
        .where(
          and(
            eq(demoLedger.cardId, card.id),
            ne(demoLedger.status, "failed"),
            gte(demoLedger.createdAt, month),
          ),
        );
      const reason = card.frozen
        ? "Declined: the card is frozen."
        : Number(spent[0]?.total ?? 0) + cents > card.limitMinor
          ? "Declined: over the card's monthly limit."
          : (await this.core.balance(tx, userId, "USD")) < units
            ? "Declined: insufficient USD balance."
            : null;
      const base = {
        userId,
        idempotencyKey: key,
        type: "card_spend",
        cardId: card.id,
        debitAsset: "USD",
        debitUnits: units,
        currency: "USD",
        usdCents: cents,
        description: `${merchant} · card •••• ${card.last4}`,
        meta: { merchant, card: `•••• ${card.last4}` },
      };
      if (reason) {
        await this.core.notify(
          tx,
          userId,
          "Security",
          `${merchant}: ${reason}`,
        );
        return this.core.record(tx, { ...base, status: "failed", reason });
      }
      await this.core.adjust(tx, userId, "USD", -units);
      return this.core.record(tx, { ...base, status: "completed" });
    });
  }

  /* ---------- wealth ---------- */

  invest(userId: string, body: unknown, key?: string) {
    const input = parse(
      z.strictObject({
        productId: z.enum(WEALTH.map((p) => p.id) as [string, ...string[]]),
        amount: z.union([z.string(), z.number()]),
        acknowledgedRisk: z.literal(true, {
          error: "Confirm that you have read the risk disclosure.",
        }),
      }),
      body,
    );
    const product = WEALTH.find((item) => item.id === input.productId)!;
    if (!product.eligible)
      throw new BadRequestException(
        "This product is not available in your country.",
      );
    const cashUnits = toUnits(input.amount, 2);
    if (cashUnits < product.minimumUsd * UNIT)
      throw new BadRequestException(
        `The minimum for this product is ${product.minimumUsd} USD.`,
      );
    const productUnits = floorTo(
      Math.floor(cashUnits / product.price),
      decimalsOf(product.id),
    );
    return this.core.action(userId, key, async (tx) => {
      await this.core.gate(tx, userId);
      await this.core.adjust(tx, userId, "USD", -cashUnits);
      await this.core.adjust(tx, userId, product.id, productUnits);
      return this.core.record(tx, {
        userId,
        idempotencyKey: key,
        type: "invest",
        debitAsset: "USD",
        debitUnits: cashUnits,
        creditAsset: product.id,
        creditUnits: productUnits,
        currency: "USD",
        usdCents: Math.round(cashUnits / (UNIT / 100)),
        description: `Invest in ${product.name}`,
        status: "pending",
        settleAt: seconds(15),
      });
    });
  }
}
