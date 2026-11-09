import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { AuthService, SessionGuard } from "./auth";
import {
  accountProfiles,
  adminAuditLog,
  authenticationSessions,
  contactMessages,
  demoHoldings,
  demoLedger,
  supportTickets,
  users,
  verificationCases,
  waitlist,
} from "./db/schema";
import { DemoCore } from "./demo/core";
import { RecordsService } from "./demo/records";

type AdminRequest = { userId: string };
const PAGE_SIZE = 25;

/** Runs after SessionGuard and admits only accounts flagged as admin. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DemoCore) private readonly core: DemoCore) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { userId } = context.switchToHttp().getRequest<AdminRequest>();
    const [user] = await this.core.db
      .select({ isAdmin: users.isAdmin, suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.isAdmin || user.suspendedAt)
      throw new ForbiddenException("Admin access only.");
    return true;
  }
}

const page = (raw?: string) => {
  const n = Number(raw ?? 1);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
};
const term = (raw?: string) => raw?.trim().slice(0, 100) || undefined;
const like = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
/** Quote a CSV cell and defuse values a spreadsheet would run as a formula. */
const cell = (value: unknown) => {
  const text =
    value instanceof Date ? value.toISOString() : String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
const csv = (head: string[], rows: unknown[][]) =>
  [head.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");

const userFilter = z.enum([
  "all",
  "admins",
  "suspended",
  "unverified",
  "in_review",
]);
const ticketStatus = z.enum(["open", "pending", "resolved"]);

@Injectable()
export class AdminService {
  constructor(
    @Inject(DemoCore) private readonly core: DemoCore,
    @Inject(RecordsService) private readonly records: RecordsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private get db() {
    return this.core.db;
  }

  private log(
    adminId: string,
    action: string,
    targetUserId?: string | null,
    detail?: string,
  ) {
    return this.db.insert(adminAuditLog).values({
      adminId,
      action,
      targetUserId: targetUserId ?? null,
      detail: detail?.slice(0, 240),
    });
  }

  async overview() {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
    const day = (column: SQL | AnyPgColumn) =>
      sql<string>`to_char(date_trunc('day', ${column}), 'YYYY-MM-DD')`;
    const [[u], [w], [m], [t], [active], cases, tickets, signups, volume] =
      await Promise.all([
        this.db
          .select({
            total: count(),
            lastWeek: sql<number>`count(*) filter (where ${users.createdAt} > now() - interval '7 days')::int`,
            verifiedEmail: sql<number>`count(${users.emailVerifiedAt})::int`,
            suspended: sql<number>`count(${users.suspendedAt})::int`,
            admins: sql<number>`count(*) filter (where ${users.isAdmin})::int`,
          })
          .from(users),
        this.db.select({ total: count() }).from(waitlist),
        this.db.select({ total: count() }).from(contactMessages),
        this.db
          .select({
            total: count(),
            lastWeek: sql<number>`count(*) filter (where ${demoLedger.createdAt} > now() - interval '7 days')::int`,
          })
          .from(demoLedger),
        this.db
          .select({
            total: sql<number>`count(distinct ${authenticationSessions.userId})::int`,
          })
          .from(authenticationSessions)
          .where(
            and(
              isNull(authenticationSessions.revokedAt),
              gt(authenticationSessions.expiresAt, now),
            ),
          ),
        this.db
          .select({
            kind: verificationCases.kind,
            status: verificationCases.status,
            total: count(),
          })
          .from(verificationCases)
          .groupBy(verificationCases.kind, verificationCases.status),
        this.db
          .select({ status: supportTickets.status, total: count() })
          .from(supportTickets)
          .groupBy(supportTickets.status),
        this.db
          .select({ day: day(users.createdAt), total: count() })
          .from(users)
          .where(gte(users.createdAt, monthAgo))
          .groupBy(sql`1`)
          .orderBy(sql`1`),
        this.db
          .select({
            day: day(demoLedger.createdAt),
            total: count(),
            usdCents: sql<number>`coalesce(sum(${demoLedger.usdCents}), 0)::float8`,
          })
          .from(demoLedger)
          .where(gte(demoLedger.createdAt, monthAgo))
          .groupBy(sql`1`)
          .orderBy(sql`1`),
      ]);
    const verification: Record<string, Record<string, number>> = {
      kyc: {},
      kyb: {},
    };
    for (const c of cases)
      (verification[c.kind] ??= {})[c.status] = Number(c.total);
    return {
      users: {
        total: Number(u.total),
        lastWeek: u.lastWeek,
        verifiedEmail: u.verifiedEmail,
        suspended: u.suspended,
        admins: u.admins,
        active: active.total,
      },
      waitlist: Number(w.total),
      messages: Number(m.total),
      transactions: { total: Number(t.total), lastWeek: t.lastWeek },
      verification,
      inReview:
        (verification.kyc.in_review ?? 0) + (verification.kyb.in_review ?? 0),
      tickets: Object.fromEntries(
        tickets.map((x) => [x.status, Number(x.total)]),
      ),
      signups: signups.map((s) => ({ day: s.day, total: Number(s.total) })),
      volume: volume.map((v) => ({
        day: v.day,
        total: Number(v.total),
        usdCents: Number(v.usdCents),
      })),
    };
  }

  async listUsers(query: { search?: string; filter?: string; page?: string }) {
    const p = page(query.page);
    const q = term(query.search);
    const filter = userFilter.catch("all").parse(query.filter ?? "all");
    const kyc = sql<
      string | null
    >`(select status from verification_cases v where v.user_id = ${users.id} and v.kind = 'kyc')`;
    const conditions: (SQL | undefined)[] = [
      q
        ? or(ilike(users.email, like(q)), ilike(users.fullName, like(q)))
        : undefined,
      filter === "admins" ? eq(users.isAdmin, true) : undefined,
      filter === "suspended" ? isNotNull(users.suspendedAt) : undefined,
      filter === "unverified"
        ? and(isNull(users.emailVerifiedAt), isNull(users.provisionedAt))
        : undefined,
      filter === "in_review"
        ? sql`exists (select 1 from verification_cases v where v.user_id = ${users.id} and v.status = 'in_review')`
        : undefined,
    ];
    const where = and(...conditions.filter(Boolean));
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
          provisionedAt: users.provisionedAt,
          isAdmin: users.isAdmin,
          suspendedAt: users.suspendedAt,
          createdAt: users.createdAt,
          accountType: accountProfiles.accountType,
          kyc,
        })
        .from(users)
        .leftJoin(accountProfiles, eq(accountProfiles.userId, users.id))
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(PAGE_SIZE)
        .offset((p - 1) * PAGE_SIZE),
      this.db.select({ total: count() }).from(users).where(where),
    ]);
    return { rows, page: p, pageSize: PAGE_SIZE, total: Number(total.total) };
  }

  async user(id: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        provisionedAt: users.provisionedAt,
        isAdmin: users.isAdmin,
        suspendedAt: users.suspendedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException("User not found.");
    const [profile, holdings, ledger, cases, sessions, tickets, history] =
      await Promise.all([
        this.db
          .select({
            accountType: accountProfiles.accountType,
            businessName: accountProfiles.businessName,
            referralCode: accountProfiles.referralCode,
            mfaEnabled: accountProfiles.mfaEnabled,
            fundedAt: accountProfiles.fundedAt,
          })
          .from(accountProfiles)
          .where(eq(accountProfiles.userId, id))
          .limit(1),
        this.db
          .select({ asset: demoHoldings.asset, units: demoHoldings.units })
          .from(demoHoldings)
          .where(eq(demoHoldings.userId, id)),
        this.db
          .select({
            id: demoLedger.id,
            type: demoLedger.type,
            status: demoLedger.status,
            description: demoLedger.description,
            reference: demoLedger.reference,
            currency: demoLedger.currency,
            usdCents: demoLedger.usdCents,
            createdAt: demoLedger.createdAt,
          })
          .from(demoLedger)
          .where(eq(demoLedger.userId, id))
          .orderBy(desc(demoLedger.createdAt))
          .limit(20),
        this.db
          .select({
            kind: verificationCases.kind,
            status: verificationCases.status,
            data: verificationCases.data,
            note: verificationCases.note,
            submittedAt: verificationCases.submittedAt,
            decidedAt: verificationCases.decidedAt,
          })
          .from(verificationCases)
          .where(eq(verificationCases.userId, id)),
        this.db
          .select({
            id: authenticationSessions.id,
            createdAt: authenticationSessions.createdAt,
            expiresAt: authenticationSessions.expiresAt,
          })
          .from(authenticationSessions)
          .where(
            and(
              eq(authenticationSessions.userId, id),
              isNull(authenticationSessions.revokedAt),
              gt(authenticationSessions.expiresAt, new Date()),
            ),
          )
          .orderBy(desc(authenticationSessions.createdAt)),
        this.db
          .select({
            id: supportTickets.id,
            number: supportTickets.number,
            subject: supportTickets.subject,
            status: supportTickets.status,
            createdAt: supportTickets.createdAt,
          })
          .from(supportTickets)
          .where(eq(supportTickets.userId, id))
          .orderBy(desc(supportTickets.createdAt)),
        this.db
          .select({
            id: adminAuditLog.id,
            action: adminAuditLog.action,
            detail: adminAuditLog.detail,
            createdAt: adminAuditLog.createdAt,
          })
          .from(adminAuditLog)
          .where(eq(adminAuditLog.targetUserId, id))
          .orderBy(desc(adminAuditLog.createdAt))
          .limit(20),
      ]);
    return {
      user,
      profile: profile[0] ?? null,
      holdings,
      ledger,
      verification: cases,
      sessions,
      tickets,
      history,
    };
  }

  /** Loads another user for an admin action; admins cannot act on themselves. */
  private async target(adminId: string, id: string) {
    if (adminId === id)
      throw new BadRequestException(
        "Use your own account settings for your account.",
      );
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        isAdmin: users.isAdmin,
        suspendedAt: users.suspendedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }

  private revokeSessions(id: string) {
    return this.db
      .update(authenticationSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authenticationSessions.userId, id),
          isNull(authenticationSessions.revokedAt),
        ),
      );
  }

  async suspend(adminId: string, id: string, body: unknown) {
    const { reason } = z
      .strictObject({ reason: z.string().trim().max(200).optional() })
      .parse(body ?? {});
    const user = await this.target(adminId, id);
    if (user.isAdmin)
      throw new BadRequestException("Remove admin access before suspending.");
    if (user.suspendedAt)
      return { message: `${user.email} is already suspended.` };
    await this.db
      .update(users)
      .set({ suspendedAt: new Date() })
      .where(eq(users.id, id));
    await this.revokeSessions(id);
    await this.log(adminId, "user.suspend", id, reason);
    return { message: `${user.email} suspended and signed out.` };
  }

  async unsuspend(adminId: string, id: string) {
    const user = await this.target(adminId, id);
    await this.db
      .update(users)
      .set({ suspendedAt: null })
      .where(eq(users.id, id));
    await this.log(adminId, "user.unsuspend", id);
    return { message: `${user.email} reactivated.` };
  }

  async signOut(adminId: string, id: string) {
    const user = await this.target(adminId, id);
    await this.revokeSessions(id);
    await this.log(adminId, "user.sign_out_all", id);
    return { message: `${user.email} signed out of all devices.` };
  }

  async passwordReset(adminId: string, id: string) {
    const user = await this.target(adminId, id);
    await this.auth.forgot({ email: user.email });
    await this.log(adminId, "user.password_reset", id);
    return { message: `Password reset email sent to ${user.email}.` };
  }

  async verifications(status?: string) {
    const which = z
      .enum(["in_review", "action_required", "verified", "rejected", "all"])
      .catch("in_review")
      .parse(status ?? "in_review");
    return this.db
      .select({
        userId: verificationCases.userId,
        kind: verificationCases.kind,
        status: verificationCases.status,
        data: verificationCases.data,
        note: verificationCases.note,
        submittedAt: verificationCases.submittedAt,
        decidedAt: verificationCases.decidedAt,
        fullName: users.fullName,
        email: users.email,
      })
      .from(verificationCases)
      .innerJoin(users, eq(users.id, verificationCases.userId))
      .where(
        which === "all"
          ? isNotNull(verificationCases.submittedAt)
          : eq(verificationCases.status, which),
      )
      .orderBy(
        which === "in_review"
          ? verificationCases.submittedAt
          : desc(verificationCases.submittedAt),
      )
      .limit(200);
  }

  async decide(adminId: string, userId: string, kind: string, body: unknown) {
    const result = await this.records.review(userId, kind, body);
    const decision = (body as { decision?: string })?.decision ?? "";
    await this.log(adminId, `verification.${decision}`, userId, kind);
    return result;
  }

  private ledgerWhere(query: {
    search?: string;
    type?: string;
    status?: string;
  }) {
    const q = term(query.search);
    return and(
      ...[
        q
          ? or(
              ilike(users.email, like(q)),
              ilike(demoLedger.description, like(q)),
              ilike(demoLedger.reference, like(q)),
            )
          : undefined,
        query.type && /^[a-z_]{2,20}$/.test(query.type)
          ? eq(demoLedger.type, query.type)
          : undefined,
        query.status && /^[a-z_]{2,12}$/.test(query.status)
          ? eq(demoLedger.status, query.status)
          : undefined,
      ].filter(Boolean),
    );
  }

  private ledgerColumns = {
    id: demoLedger.id,
    type: demoLedger.type,
    status: demoLedger.status,
    description: demoLedger.description,
    reference: demoLedger.reference,
    currency: demoLedger.currency,
    usdCents: demoLedger.usdCents,
    createdAt: demoLedger.createdAt,
    userId: users.id,
    email: users.email,
  };

  async transactions(query: {
    search?: string;
    type?: string;
    status?: string;
    page?: string;
  }) {
    const p = page(query.page);
    const where = this.ledgerWhere(query);
    const [rows, [total]] = await Promise.all([
      this.db
        .select(this.ledgerColumns)
        .from(demoLedger)
        .innerJoin(users, eq(users.id, demoLedger.userId))
        .where(where)
        .orderBy(desc(demoLedger.createdAt))
        .limit(PAGE_SIZE)
        .offset((p - 1) * PAGE_SIZE),
      this.db
        .select({ total: count() })
        .from(demoLedger)
        .innerJoin(users, eq(users.id, demoLedger.userId))
        .where(where),
    ]);
    return { rows, page: p, pageSize: PAGE_SIZE, total: Number(total.total) };
  }

  async transactionsCsv(
    adminId: string,
    query: { search?: string; type?: string; status?: string },
  ) {
    const rows = await this.db
      .select(this.ledgerColumns)
      .from(demoLedger)
      .innerJoin(users, eq(users.id, demoLedger.userId))
      .where(this.ledgerWhere(query))
      .orderBy(desc(demoLedger.createdAt))
      .limit(10_000);
    await this.log(adminId, "transactions.export", null, `${rows.length} rows`);
    return csv(
      [
        "date",
        "email",
        "type",
        "status",
        "description",
        "reference",
        "currency",
        "usd",
      ],
      rows.map((r) => [
        r.createdAt,
        r.email,
        r.type,
        r.status,
        r.description,
        r.reference,
        r.currency,
        (r.usdCents / 100).toFixed(2),
      ]),
    );
  }

  async messages(query: { search?: string; page?: string }) {
    const p = page(query.page);
    const q = term(query.search);
    const where = q
      ? or(
          ilike(contactMessages.email, like(q)),
          ilike(contactMessages.name, like(q)),
          ilike(contactMessages.message, like(q)),
        )
      : undefined;
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(contactMessages)
        .where(where)
        .orderBy(desc(contactMessages.createdAt))
        .limit(PAGE_SIZE)
        .offset((p - 1) * PAGE_SIZE),
      this.db.select({ total: count() }).from(contactMessages).where(where),
    ]);
    return { rows, page: p, pageSize: PAGE_SIZE, total: Number(total.total) };
  }

  async tickets(query: { status?: string; page?: string }) {
    const p = page(query.page);
    const status = ticketStatus.safeParse(query.status);
    const where = status.success
      ? eq(supportTickets.status, status.data)
      : undefined;
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: supportTickets.id,
          number: supportTickets.number,
          subject: supportTickets.subject,
          body: supportTickets.body,
          status: supportTickets.status,
          createdAt: supportTickets.createdAt,
          userId: users.id,
          email: users.email,
          fullName: users.fullName,
        })
        .from(supportTickets)
        .innerJoin(users, eq(users.id, supportTickets.userId))
        .where(where)
        .orderBy(desc(supportTickets.createdAt))
        .limit(PAGE_SIZE)
        .offset((p - 1) * PAGE_SIZE),
      this.db.select({ total: count() }).from(supportTickets).where(where),
    ]);
    return { rows, page: p, pageSize: PAGE_SIZE, total: Number(total.total) };
  }

  async setTicketStatus(adminId: string, id: string, body: unknown) {
    const { status } = z.strictObject({ status: ticketStatus }).parse(body);
    const [ticket] = await this.db
      .update(supportTickets)
      .set({ status })
      .where(eq(supportTickets.id, id))
      .returning({
        userId: supportTickets.userId,
        number: supportTickets.number,
      });
    if (!ticket) throw new NotFoundException("Ticket not found.");
    await this.log(
      adminId,
      `ticket.${status}`,
      ticket.userId,
      `Ticket #${ticket.number}`,
    );
    return { message: `Ticket #${ticket.number} marked ${status}.` };
  }

  async waitlist(query: { search?: string; page?: string }) {
    const p = page(query.page);
    const q = term(query.search);
    const where = q ? ilike(waitlist.email, like(q)) : undefined;
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(waitlist)
        .where(where)
        .orderBy(desc(waitlist.createdAt))
        .limit(PAGE_SIZE)
        .offset((p - 1) * PAGE_SIZE),
      this.db.select({ total: count() }).from(waitlist).where(where),
    ]);
    return { rows, page: p, pageSize: PAGE_SIZE, total: Number(total.total) };
  }

  async waitlistCsv(adminId: string) {
    const rows = await this.db
      .select()
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt));
    await this.log(adminId, "waitlist.export", null, `${rows.length} rows`);
    return csv(
      ["email", "consent_at", "joined_at"],
      rows.map((r) => [r.email, r.consentAt, r.createdAt]),
    );
  }

  async audit(query: { page?: string }) {
    const p = page(query.page);
    const admin = alias(users, "admin");
    const target = alias(users, "target");
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: adminAuditLog.id,
          action: adminAuditLog.action,
          detail: adminAuditLog.detail,
          createdAt: adminAuditLog.createdAt,
          adminEmail: admin.email,
          targetId: target.id,
          targetEmail: target.email,
        })
        .from(adminAuditLog)
        .leftJoin(admin, eq(admin.id, adminAuditLog.adminId))
        .leftJoin(target, eq(target.id, adminAuditLog.targetUserId))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(PAGE_SIZE)
        .offset((p - 1) * PAGE_SIZE),
      this.db.select({ total: count() }).from(adminAuditLog),
    ]);
    return { rows, page: p, pageSize: PAGE_SIZE, total: Number(total.total) };
  }
}

@ApiTags("Admin")
@ApiCookieAuth("regalvest_session")
@UseGuards(SessionGuard, AdminGuard)
@Controller("api/v1/admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  @ApiOperation({ summary: "Totals, 30-day trends and work queues" })
  overview() {
    return this.admin.overview();
  }

  @Get("users")
  @ApiOperation({ summary: "Search and filter accounts, 25 per page" })
  users(
    @Query("search") search?: string,
    @Query("filter") filter?: string,
    @Query("page") page?: string,
  ) {
    return this.admin.listUsers({ search, filter, page });
  }

  @Get("users/:id")
  @ApiOperation({ summary: "Full profile of one account" })
  user(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.user(id);
  }

  @Post("users/:id/suspend")
  @HttpCode(200)
  suspend(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.suspend(req.userId, id, body);
  }

  @Post("users/:id/unsuspend")
  @HttpCode(200)
  unsuspend(@Req() req: AdminRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.admin.unsuspend(req.userId, id);
  }

  @Post("users/:id/sign-out")
  @HttpCode(200)
  signOut(@Req() req: AdminRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.admin.signOut(req.userId, id);
  }

  @Post("users/:id/password-reset")
  @HttpCode(200)
  @ApiOperation({ summary: "Email the account a password reset link" })
  passwordReset(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.admin.passwordReset(req.userId, id);
  }

  @Get("verifications")
  @ApiOperation({
    summary: "Verification cases by status (default: in review)",
  })
  verifications(@Query("status") status?: string) {
    return this.admin.verifications(status);
  }

  @Post("verifications/:userId/:kind")
  @HttpCode(200)
  @ApiOperation({
    summary: "Approve, request information on, or reject a case in review",
  })
  decide(
    @Req() req: AdminRequest,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Param("kind") kind: string,
    @Body() body: unknown,
  ) {
    return this.admin.decide(req.userId, userId, kind, body);
  }

  @Get("transactions")
  @ApiOperation({ summary: "Ledger entries across accounts, 25 per page" })
  transactions(
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
  ) {
    return this.admin.transactions({ search, type, status, page });
  }

  @Get("transactions.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="transactions.csv"')
  @Header("Cache-Control", "no-store")
  transactionsCsv(
    @Req() req: AdminRequest,
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
  ) {
    return this.admin.transactionsCsv(req.userId, { search, type, status });
  }

  @Get("messages")
  messages(@Query("search") search?: string, @Query("page") page?: string) {
    return this.admin.messages({ search, page });
  }

  @Get("tickets")
  tickets(@Query("status") status?: string, @Query("page") page?: string) {
    return this.admin.tickets({ status, page });
  }

  @Post("tickets/:id/status")
  @HttpCode(200)
  setTicketStatus(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.setTicketStatus(req.userId, id, body);
  }

  @Get("waitlist")
  waitlist(@Query("search") search?: string, @Query("page") page?: string) {
    return this.admin.waitlist({ search, page });
  }

  @Get("waitlist.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="waitlist.csv"')
  @Header("Cache-Control", "no-store")
  waitlistCsv(@Req() req: AdminRequest) {
    return this.admin.waitlistCsv(req.userId);
  }

  @Get("audit")
  @ApiOperation({ summary: "Admin activity log, newest first" })
  audit(@Query("page") page?: string) {
    return this.admin.audit({ page });
  }
}
