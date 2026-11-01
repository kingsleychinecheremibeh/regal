import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { SessionGuard } from "./auth";
import {
  contactMessages,
  demoTransactions,
  users,
  verificationCases,
  waitlist,
} from "./db/schema";
import { DemoCore } from "./demo/core";
import { RecordsService } from "./demo/records";

/** Runs after SessionGuard and admits only accounts flagged as admin. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DemoCore) private readonly core: DemoCore) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { userId } = context.switchToHttp().getRequest<{ userId: string }>();
    const [user] = await this.core.db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.isAdmin) throw new ForbiddenException("Admin access only.");
    return true;
  }
}

@ApiTags("Admin")
@ApiCookieAuth("regalvest_session")
@UseGuards(SessionGuard, AdminGuard)
@Controller("api/v1/admin")
export class AdminController {
  constructor(
    @Inject(DemoCore) private readonly core: DemoCore,
    @Inject(RecordsService) private readonly records: RecordsService,
  ) {}

  private get db() {
    return this.core.db;
  }

  @Get("overview")
  @ApiOperation({ summary: "Platform totals for the admin overview" })
  async overview() {
    const [[u], [w], [m], [t], cases] = await Promise.all([
      this.db
        .select({
          total: count(),
          lastWeek: sql<number>`count(*) filter (where ${users.createdAt} > now() - interval '7 days')`,
        })
        .from(users),
      this.db.select({ total: count() }).from(waitlist),
      this.db.select({ total: count() }).from(contactMessages),
      this.db.select({ total: count() }).from(demoTransactions),
      this.db
        .select({ status: verificationCases.status, total: count() })
        .from(verificationCases)
        .groupBy(verificationCases.status),
    ]);
    return {
      users: Number(u.total),
      usersLastWeek: Number(u.lastWeek),
      waitlist: Number(w.total),
      messages: Number(m.total),
      transactions: Number(t.total),
      verification: Object.fromEntries(
        cases.map((c) => [c.status, Number(c.total)]),
      ),
    };
  }

  @Get("users")
  @ApiOperation({ summary: "Latest 200 accounts" })
  async users() {
    return this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        kyc: sql<
          string | null
        >`(select status from verification_cases v where v.user_id = ${users.id} and v.kind = 'kyc')`,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(200);
  }

  @Get("verifications")
  @ApiOperation({ summary: "Verification cases waiting for a decision" })
  async verifications() {
    return this.db
      .select({
        userId: verificationCases.userId,
        kind: verificationCases.kind,
        status: verificationCases.status,
        data: verificationCases.data,
        submittedAt: verificationCases.submittedAt,
        fullName: users.fullName,
        email: users.email,
      })
      .from(verificationCases)
      .innerJoin(users, eq(users.id, verificationCases.userId))
      .where(eq(verificationCases.status, "in_review"))
      .orderBy(verificationCases.submittedAt);
  }

  @Post("verifications/:userId/:kind")
  @HttpCode(200)
  @ApiOperation({
    summary: "Approve, request information on, or reject a case in review",
  })
  decide(
    @Param("userId") userId: string,
    @Param("kind") kind: string,
    @Body() body: unknown,
  ) {
    if (!z.uuid().safeParse(userId).success)
      throw new BadRequestException("Unknown user.");
    return this.records.review(userId, kind, body);
  }

  @Get("transactions")
  @ApiOperation({ summary: "Latest 200 transactions across all accounts" })
  async transactions() {
    return this.db
      .select({
        id: demoTransactions.id,
        kind: demoTransactions.kind,
        amountMinor: demoTransactions.amountMinor,
        description: demoTransactions.description,
        createdAt: demoTransactions.createdAt,
        email: users.email,
      })
      .from(demoTransactions)
      .innerJoin(users, eq(users.id, demoTransactions.userId))
      .orderBy(desc(demoTransactions.createdAt))
      .limit(200);
  }

  @Get("messages")
  @ApiOperation({ summary: "Latest 100 contact form messages" })
  async messages() {
    return this.db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(100);
  }
}
