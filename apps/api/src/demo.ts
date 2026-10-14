import {
  applyDecorators,
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { SessionGuard } from "./auth";
import { Database } from "./db/database";
import {
  demoBalances,
  demoCards,
  demoNotifications,
  demoOrders,
  demoSavingsGoals,
  demoTransactions,
} from "./db/schema";

type UserRequest = { userId: string };
const amount = z.number().int().positive().max(100000000);
const key = z.string().min(8).max(100);
const markets = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    examplePriceMinor: 6500000,
    exampleChangePercent: 2.4,
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    examplePriceMinor: 320000,
    exampleChangePercent: -0.8,
  },
  {
    name: "S&P 500 ETF",
    symbol: "SPY",
    examplePriceMinor: 56000,
    exampleChangePercent: 0.6,
  },
];
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? "Invalid input",
    );
  return parsed.data;
}

function DemoMoneyAction(summary: string) {
  return applyDecorators(
    ApiOperation({ summary: `${summary} using simulated funds only` }),
    ApiHeader({
      name: "Idempotency-Key",
      required: true,
      description: "Unique key per intended action (8–100 characters)",
    }),
    ApiBody({
      schema: {
        type: "object",
        required: ["amountMinor", "description"],
        properties: {
          amountMinor: {
            type: "integer",
            minimum: 1,
            example: 2500,
            description: "Demo USD cents",
          },
          description: { type: "string", example: "Example demo action" },
          symbol: { type: "string", example: "BTC" },
          goalId: { type: "string", format: "uuid" },
        },
      },
    }),
    ApiBadRequestResponse({
      description: "Invalid amount, insufficient demo balance or goal mismatch",
    }),
  );
}

@Injectable()
export class DemoService {
  constructor(@Inject(Database) private readonly database: Database) {}
  async overview(userId: string) {
    const [balances, transactions, goals, cards, notifications] =
      await Promise.all([
        this.database.db
          .select()
          .from(demoBalances)
          .where(eq(demoBalances.userId, userId))
          .limit(1),
        this.database.db
          .select()
          .from(demoTransactions)
          .where(eq(demoTransactions.userId, userId))
          .orderBy(desc(demoTransactions.createdAt))
          .limit(10),
        this.database.db
          .select()
          .from(demoSavingsGoals)
          .where(eq(demoSavingsGoals.userId, userId)),
        this.database.db
          .select()
          .from(demoCards)
          .where(eq(demoCards.userId, userId)),
        this.database.db
          .select()
          .from(demoNotifications)
          .where(eq(demoNotifications.userId, userId))
          .orderBy(desc(demoNotifications.createdAt))
          .limit(5),
      ]);
    return {
      label: "DEMO DATA",
      currency: "USD",
      balances: balances[0],
      transactions,
      goals,
      cards,
      notifications,
    };
  }
  markets() {
    return { label: "SIMULATED PRICES", assets: markets };
  }
  transactions(userId: string) {
    return this.database.db
      .select()
      .from(demoTransactions)
      .where(eq(demoTransactions.userId, userId))
      .orderBy(desc(demoTransactions.createdAt))
      .limit(100);
  }
  goals(userId: string) {
    return this.database.db
      .select()
      .from(demoSavingsGoals)
      .where(eq(demoSavingsGoals.userId, userId))
      .orderBy(desc(demoSavingsGoals.createdAt));
  }
  cards(userId: string) {
    return this.database.db
      .select()
      .from(demoCards)
      .where(eq(demoCards.userId, userId));
  }
  orders(userId: string) {
    return this.database.db
      .select()
      .from(demoOrders)
      .where(eq(demoOrders.userId, userId))
      .orderBy(desc(demoOrders.createdAt));
  }
  notifications(userId: string) {
    return this.database.db
      .select()
      .from(demoNotifications)
      .where(eq(demoNotifications.userId, userId))
      .orderBy(desc(demoNotifications.createdAt));
  }
  async goal(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({
        name: z.string().trim().min(2).max(80),
        targetMinor: amount,
      }),
      body,
    );
    const rows = await this.database.db
      .insert(demoSavingsGoals)
      .values({ userId, ...input })
      .returning();
    return rows[0];
  }
  async editGoal(userId: string, id: string, body: unknown) {
    const input = parse(
      z.strictObject({
        name: z.string().trim().min(2).max(80).optional(),
        targetMinor: amount.optional(),
      }),
      body,
    );
    const rows = await this.database.db
      .update(demoSavingsGoals)
      .set(input)
      .where(
        and(eq(demoSavingsGoals.id, id), eq(demoSavingsGoals.userId, userId)),
      )
      .returning();
    if (!rows[0]) throw new BadRequestException("Goal not found");
    return rows[0];
  }
  async createCard(userId: string, body: unknown) {
    const input = parse(
      z.strictObject({ label: z.string().trim().min(2).max(80) }),
      body,
    );
    const rows = await this.database.db
      .insert(demoCards)
      .values({ userId, label: input.label })
      .returning();
    return rows[0];
  }
  async updateCard(userId: string, id: string, body: unknown) {
    const input = parse(
      z.strictObject({
        frozen: z.boolean().optional(),
        limitMinor: amount.optional(),
      }),
      body,
    );
    const rows = await this.database.db
      .update(demoCards)
      .set(input)
      .where(and(eq(demoCards.id, id), eq(demoCards.userId, userId)))
      .returning();
    if (!rows[0]) throw new BadRequestException("Card not found");
    return rows[0];
  }
  async move(
    userId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ) {
    const input = parse(
      z.strictObject({
        kind: z.enum(["save", "withdraw", "transfer", "trade", "invest"]),
        amountMinor: amount,
        description: z.string().trim().min(2).max(160),
        symbol: z.string().max(20).optional(),
        goalId: z.uuid().optional(),
      }),
      body,
    );
    const safeKey = parse(key, idempotencyKey);
    return this.database.db.transaction(async (tx) => {
      const balances = await tx
        .select()
        .from(demoBalances)
        .where(eq(demoBalances.userId, userId))
        .for("update");
      const current = balances[0];
      if (!current) throw new BadRequestException("Demo account unavailable");
      const previous = await tx
        .select()
        .from(demoTransactions)
        .where(
          and(
            eq(demoTransactions.userId, userId),
            eq(demoTransactions.idempotencyKey, safeKey),
          ),
        )
        .limit(1);
      if (previous[0]) return { transaction: previous[0], duplicate: true };
      const debit = input.kind === "withdraw" ? "savingsMinor" : "cashMinor";
      if (current[debit] < input.amountMinor)
        throw new BadRequestException("Insufficient demo balance");
      if (input.goalId && input.kind !== "save" && input.kind !== "withdraw")
        throw new BadRequestException("Goal allocation is only for savings");
      if (input.kind === "save" || input.kind === "withdraw") {
        const goals = await tx
          .select()
          .from(demoSavingsGoals)
          .where(eq(demoSavingsGoals.userId, userId))
          .for("update");
        const selected = goals.find((goal) => goal.id === input.goalId);
        if (input.goalId && !selected)
          throw new BadRequestException("Goal not found");
        if (selected && input.kind === "save") {
          if (selected.savedMinor + input.amountMinor > selected.targetMinor)
            throw new BadRequestException("Amount exceeds the goal target");
          await tx
            .update(demoSavingsGoals)
            .set({ savedMinor: selected.savedMinor + input.amountMinor })
            .where(eq(demoSavingsGoals.id, selected.id));
        }
        if (selected && input.kind === "withdraw") {
          if (selected.savedMinor < input.amountMinor)
            throw new BadRequestException("Insufficient goal balance");
          await tx
            .update(demoSavingsGoals)
            .set({ savedMinor: selected.savedMinor - input.amountMinor })
            .where(eq(demoSavingsGoals.id, selected.id));
        }
        if (!selected && input.kind === "withdraw") {
          const allocated = goals.reduce(
            (total, goal) => total + goal.savedMinor,
            0,
          );
          if (current.savingsMinor - allocated < input.amountMinor)
            throw new BadRequestException("Insufficient unallocated savings");
        }
      }
      const changes =
        input.kind === "save"
          ? {
              cashMinor: current.cashMinor - input.amountMinor,
              savingsMinor: current.savingsMinor + input.amountMinor,
            }
          : input.kind === "withdraw"
            ? {
                cashMinor: current.cashMinor + input.amountMinor,
                savingsMinor: current.savingsMinor - input.amountMinor,
              }
            : input.kind === "invest" || input.kind === "trade"
              ? {
                  cashMinor: current.cashMinor - input.amountMinor,
                  investmentMinor: current.investmentMinor + input.amountMinor,
                }
              : { cashMinor: current.cashMinor - input.amountMinor };
      await tx
        .update(demoBalances)
        .set(changes)
        .where(eq(demoBalances.userId, userId));
      const rows = await tx
        .insert(demoTransactions)
        .values({
          userId,
          kind: input.kind,
          amountMinor: input.amountMinor,
          description: input.description,
          idempotencyKey: safeKey,
        })
        .returning();
      if (input.kind === "trade" || input.kind === "invest")
        await tx.insert(demoOrders).values({
          userId,
          kind: input.kind,
          symbol: input.symbol ?? "DEMO",
          amountMinor: input.amountMinor,
        });
      return { transaction: rows[0], duplicate: false };
    });
  }
  async checkIn(userId: string) {
    return this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(demoBalances)
        .where(eq(demoBalances.userId, userId))
        .for("update");
      const balance = rows[0];
      if (!balance) throw new BadRequestException("Demo account unavailable");
      const today = new Date().toISOString().slice(0, 10);
      if (balance.lastCheckIn?.toISOString().slice(0, 10) === today)
        return { points: balance.points, alreadyCheckedIn: true };
      const points = balance.points + 10;
      await tx
        .update(demoBalances)
        .set({ points, lastCheckIn: new Date() })
        .where(eq(demoBalances.userId, userId));
      await tx.insert(demoNotifications).values({
        userId,
        message: "You earned 10 demo VestPoints for checking in.",
      });
      return { points, alreadyCheckedIn: false };
    });
  }
  async reset(userId: string) {
    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(demoTransactions)
        .where(eq(demoTransactions.userId, userId));
      await tx.delete(demoOrders).where(eq(demoOrders.userId, userId));
      await tx
        .delete(demoSavingsGoals)
        .where(eq(demoSavingsGoals.userId, userId));
      await tx.delete(demoCards).where(eq(demoCards.userId, userId));
      await tx
        .delete(demoNotifications)
        .where(eq(demoNotifications.userId, userId));
      await tx
        .update(demoBalances)
        .set({
          cashMinor: 10000000,
          savingsMinor: 0,
          investmentMinor: 0,
          points: 0,
          lastCheckIn: null,
        })
        .where(eq(demoBalances.userId, userId));
    });
    return { message: "Demo data reset" };
  }
}

@ApiTags("Simulated financial demo")
@ApiCookieAuth("regalvest_session")
@ApiUnauthorizedResponse({ description: "Valid session required" })
@Controller("api/v1/demo")
@UseGuards(SessionGuard)
export class DemoController {
  constructor(@Inject(DemoService) private readonly demo: DemoService) {}
  @Get("overview") overview(@Req() req: UserRequest) {
    return this.demo.overview(req.userId);
  }
  @Get("markets") markets() {
    return this.demo.markets();
  }
  @Get("accounts") accounts(@Req() req: UserRequest) {
    return this.demo.overview(req.userId);
  }
  @Get("transactions") transactions(@Req() req: UserRequest) {
    return this.demo.transactions(req.userId);
  }
  @Get("savings") savings(@Req() req: UserRequest) {
    return this.demo.goals(req.userId);
  }
  @Post("savings/goals") goal(@Req() req: UserRequest, @Body() body: unknown) {
    return this.demo.goal(req.userId, body);
  }
  @Patch("savings/goals/:id") editGoal(
    @Req() req: UserRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.demo.editGoal(req.userId, id, body);
  }
  @Get("cards") cards(@Req() req: UserRequest) {
    return this.demo.cards(req.userId);
  }
  @Post("cards") card(@Req() req: UserRequest, @Body() body: unknown) {
    return this.demo.createCard(req.userId, body);
  }
  @Patch("cards/:id") updateCard(
    @Req() req: UserRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.demo.updateCard(req.userId, id, body);
  }
  @Get("investments") investments(@Req() req: UserRequest) {
    return this.demo.orders(req.userId);
  }
  @Post("investments/orders")
  @DemoMoneyAction("Place an example investment order")
  investment(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") keyValue?: string,
  ) {
    return this.demo.move(
      req.userId,
      { ...(body as object), kind: "invest" },
      keyValue,
    );
  }
  @Post("trades") @DemoMoneyAction("Place an example trade") trade(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") keyValue?: string,
  ) {
    return this.demo.move(
      req.userId,
      { ...(body as object), kind: "trade" },
      keyValue,
    );
  }
  @Post("transfers") @DemoMoneyAction("Preview a demo transfer") transfer(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") keyValue?: string,
  ) {
    return this.demo.move(
      req.userId,
      { ...(body as object), kind: "transfer" },
      keyValue,
    );
  }
  @Post("savings/deposit")
  @DemoMoneyAction("Move demo cash into savings")
  deposit(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") keyValue?: string,
  ) {
    return this.demo.move(
      req.userId,
      { ...(body as object), kind: "save" },
      keyValue,
    );
  }
  @Post("savings/withdraw")
  @DemoMoneyAction("Move demo savings back into cash")
  withdraw(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") keyValue?: string,
  ) {
    return this.demo.move(
      req.userId,
      { ...(body as object), kind: "withdraw" },
      keyValue,
    );
  }
  @Get("rewards") async rewards(@Req() req: UserRequest) {
    const value = await this.demo.overview(req.userId);
    return { label: "DEMO DATA", points: value.balances?.points ?? 0 };
  }
  @Post("rewards/check-in") checkIn(@Req() req: UserRequest) {
    return this.demo.checkIn(req.userId);
  }
  @Get("notifications") notifications(@Req() req: UserRequest) {
    return this.demo.notifications(req.userId);
  }
  @Post("reset") reset(@Req() req: UserRequest) {
    return this.demo.reset(req.userId);
  }
}
