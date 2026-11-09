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
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
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
import { type AppConfig } from "./config";
import { CONFIG } from "./db/database";
import {
  accountProfiles,
  adminAuditLog,
  announcements,
  demoCards,
  demoNotifications,
  ticketMessages,
  userNotes,
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

type AdminRequest = { userId: string; adminRole: AdminRole; method: string };
const PAGE_SIZE = 25;

export const ADMIN_ROLES = [
  "owner",
  "compliance",
  "support",
  "viewer",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
const ROLES_KEY = "adminRoles";
/**
 * Roles allowed to use a route besides the owner, who may use every route.
 * Without it, reads are open to every admin and writes are owner-only.
 */
const Allow = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
const roleOf = (value: string | null): AdminRole =>
  (ADMIN_ROLES as readonly string[]).includes(value ?? "")
    ? (value as AdminRole)
    : "owner";

/** Runs after SessionGuard: admits admins, then checks the route's roles. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(DemoCore) private readonly core: DemoCore,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const [user] = await this.core.db
      .select({
        isAdmin: users.isAdmin,
        adminRole: users.adminRole,
        suspendedAt: users.suspendedAt,
      })
      .from(users)
      .where(eq(users.id, req.userId));
    if (!user?.isAdmin || user.suspendedAt)
      throw new ForbiddenException("Admin access only.");
    const role = roleOf(user.adminRole);
    req.adminRole = role;
    if (role === "owner") return true;
    const allowed = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed ? allowed.includes(role) : req.method === "GET") return true;
    throw new ForbiddenException(
      `Your admin role (${role}) cannot do this. Ask an owner.`,
    );
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
    @Inject(CONFIG) private readonly config: AppConfig,
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
    const what = kind === "kyb" ? "Business" : "Identity";
    await this.log(adminId, `verification.${decision}`, userId, what);
    const done: Record<string, string> = {
      verified: "approved",
      action_required: "sent back for more information",
      rejected: "rejected",
    };
    return {
      ...(result as object),
      message: `${what} verification ${done[decision] ?? "updated"}.`,
    };
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

  /* ---------- ticket conversations ---------- */

  async ticket(id: string) {
    const [ticket] = await this.db
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
      .where(eq(supportTickets.id, id))
      .limit(1);
    if (!ticket) throw new NotFoundException("Ticket not found.");
    const messages = await this.db
      .select({
        id: ticketMessages.id,
        body: ticketMessages.body,
        fromStaff: ticketMessages.fromStaff,
        createdAt: ticketMessages.createdAt,
        author: users.fullName,
      })
      .from(ticketMessages)
      .leftJoin(users, eq(users.id, ticketMessages.authorId))
      .where(eq(ticketMessages.ticketId, id))
      .orderBy(ticketMessages.createdAt);
    return { ticket, messages };
  }

  async reply(adminId: string, id: string, body: unknown) {
    const input = z
      .strictObject({
        body: z.string().trim().min(2, "Write a reply.").max(4000),
        resolve: z.boolean().optional(),
      })
      .parse(body);
    const [ticket] = await this.db
      .select({
        userId: supportTickets.userId,
        number: supportTickets.number,
      })
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1);
    if (!ticket) throw new NotFoundException("Ticket not found.");
    const status = input.resolve ? "resolved" : "pending";
    await this.db.transaction(async (tx) => {
      await tx.insert(ticketMessages).values({
        ticketId: id,
        authorId: adminId,
        fromStaff: true,
        body: input.body,
      });
      await tx
        .update(supportTickets)
        .set({ status })
        .where(eq(supportTickets.id, id));
      await tx.insert(demoNotifications).values({
        userId: ticket.userId,
        category: "Account",
        message: `Support replied to ticket T-${ticket.number}.`,
      });
    });
    await this.log(
      adminId,
      "ticket.reply",
      ticket.userId,
      `Ticket #${ticket.number}${input.resolve ? " (resolved)" : ""}`,
    );
    return { message: `Reply sent on ticket #${ticket.number}.` };
  }

  /* ---------- staff notes ---------- */

  notes(userId: string) {
    return this.db
      .select({
        id: userNotes.id,
        body: userNotes.body,
        createdAt: userNotes.createdAt,
        author: users.fullName,
      })
      .from(userNotes)
      .leftJoin(users, eq(users.id, userNotes.authorId))
      .where(eq(userNotes.userId, userId))
      .orderBy(desc(userNotes.createdAt));
  }

  async addNote(adminId: string, userId: string, body: unknown) {
    const input = z
      .strictObject({ body: z.string().trim().min(2).max(1000) })
      .parse(body);
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new NotFoundException("User not found.");
    await this.db
      .insert(userNotes)
      .values({ userId, authorId: adminId, body: input.body });
    await this.log(adminId, "user.note", userId);
    return { message: "Note added." };
  }

  /* ---------- announcements ---------- */

  listAnnouncements() {
    return this.db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        tone: announcements.tone,
        active: announcements.active,
        createdAt: announcements.createdAt,
        author: users.fullName,
      })
      .from(announcements)
      .leftJoin(users, eq(users.id, announcements.createdBy))
      .orderBy(desc(announcements.createdAt))
      .limit(50);
  }

  async createAnnouncement(adminId: string, body: unknown) {
    const input = z
      .strictObject({
        title: z.string().trim().min(3).max(120),
        body: z.string().trim().min(3).max(600),
        tone: z.enum(["info", "success", "warning"]).default("info"),
      })
      .parse(body);
    await this.db
      .insert(announcements)
      .values({ ...input, createdBy: adminId });
    await this.log(adminId, "announcement.publish", null, input.title);
    return { message: "Announcement published to all dashboards." };
  }

  async setAnnouncement(adminId: string, id: string, body: unknown) {
    const { active } = z.strictObject({ active: z.boolean() }).parse(body);
    const [row] = await this.db
      .update(announcements)
      .set({ active })
      .where(eq(announcements.id, id))
      .returning({ title: announcements.title });
    if (!row) throw new NotFoundException("Announcement not found.");
    await this.log(
      adminId,
      active ? "announcement.publish" : "announcement.hide",
      null,
      row.title,
    );
    return { message: active ? "Announcement shown." : "Announcement hidden." };
  }

  /* ---------- team and roles ---------- */

  team() {
    return this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        adminRole: users.adminRole,
        createdAt: users.createdAt,
        lastSignIn: sql<
          string | null
        >`(select max(s.created_at) from authentication_sessions s where s.user_id = ${users.id})`,
      })
      .from(users)
      .where(eq(users.isAdmin, true))
      .orderBy(users.createdAt);
  }

  private async owners() {
    const [row] = await this.db
      .select({ total: count() })
      .from(users)
      .where(
        and(
          eq(users.isAdmin, true),
          or(eq(users.adminRole, "owner"), isNull(users.adminRole)),
        ),
      );
    return Number(row.total);
  }

  async addAdmin(adminId: string, body: unknown) {
    const input = z
      .strictObject({
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(ADMIN_ROLES),
      })
      .parse(body);
    const [user] = await this.db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
        suspendedAt: users.suspendedAt,
      })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!user)
      throw new NotFoundException(
        "No account with that email. Ask them to sign up first.",
      );
    if (user.suspendedAt)
      throw new BadRequestException("Reactivate this account first.");
    if (user.isAdmin) throw new BadRequestException("Already an admin.");
    await this.db
      .update(users)
      .set({ isAdmin: true, adminRole: input.role })
      .where(eq(users.id, user.id));
    await this.log(adminId, "team.add", user.id, input.role);
    return { message: `${input.email} added as ${input.role}.` };
  }

  async setRole(adminId: string, id: string, body: unknown) {
    const { role } = z.strictObject({ role: z.enum(ADMIN_ROLES) }).parse(body);
    if (id === adminId)
      throw new BadRequestException("You cannot change your own role.");
    const [user] = await this.db
      .select({ isAdmin: users.isAdmin, adminRole: users.adminRole })
      .from(users)
      .where(eq(users.id, id));
    if (!user?.isAdmin) throw new NotFoundException("Admin not found.");
    if (roleOf(user.adminRole) === "owner" && role !== "owner")
      if ((await this.owners()) <= 1)
        throw new BadRequestException("Keep at least one owner.");
    await this.db
      .update(users)
      .set({ adminRole: role })
      .where(eq(users.id, id));
    await this.log(adminId, "team.role", id, role);
    return { message: `Role changed to ${role}.` };
  }

  async removeAdmin(adminId: string, id: string) {
    if (id === adminId)
      throw new BadRequestException("You cannot remove yourself.");
    const [user] = await this.db
      .select({
        email: users.email,
        isAdmin: users.isAdmin,
        adminRole: users.adminRole,
      })
      .from(users)
      .where(eq(users.id, id));
    if (!user?.isAdmin) throw new NotFoundException("Admin not found.");
    if (roleOf(user.adminRole) === "owner" && (await this.owners()) <= 1)
      throw new BadRequestException("Keep at least one owner.");
    await this.db
      .update(users)
      .set({ isAdmin: false, adminRole: null })
      .where(eq(users.id, id));
    await this.revokeSessions(id);
    await this.log(adminId, "team.remove", id);
    return { message: `${user.email} is no longer an admin.` };
  }

  /* ---------- reports ---------- */

  async reports() {
    const week = (column: AnyPgColumn) =>
      sql<string>`to_char(date_trunc('week', ${column}), 'YYYY-MM-DD')`;
    const since = new Date(Date.now() - 12 * 7 * 86_400_000);
    const [weekly, verifiedWeekly, usage, [conversion], [cards], kyc] =
      await Promise.all([
        this.db
          .select({ week: week(users.createdAt), total: count() })
          .from(users)
          .where(gte(users.createdAt, since))
          .groupBy(sql`1`)
          .orderBy(sql`1`),
        this.db
          .select({ week: week(verificationCases.decidedAt), total: count() })
          .from(verificationCases)
          .where(
            and(
              eq(verificationCases.status, "verified"),
              gte(verificationCases.decidedAt, since),
            ),
          )
          .groupBy(sql`1`)
          .orderBy(sql`1`),
        this.db
          .select({
            type: demoLedger.type,
            total: count(),
            users: sql<number>`count(distinct ${demoLedger.userId})::int`,
            usdCents: sql<number>`coalesce(sum(${demoLedger.usdCents}), 0)::float8`,
          })
          .from(demoLedger)
          .groupBy(demoLedger.type)
          .orderBy(desc(count())),
        this.db
          .select({
            waitlist: count(),
            joined: sql<number>`count(*) filter (where exists (select 1 from users u where u.email = ${waitlist.email}))::int`,
          })
          .from(waitlist),
        this.db.select({ total: count() }).from(demoCards),
        this.db
          .select({ status: verificationCases.status, total: count() })
          .from(verificationCases)
          .where(eq(verificationCases.kind, "kyc"))
          .groupBy(verificationCases.status),
      ]);
    const [{ total: userTotal }] = await this.db
      .select({ total: count() })
      .from(users);
    const kycBy = Object.fromEntries(
      kyc.map((k) => [k.status, Number(k.total)]),
    );
    const submitted =
      (kycBy.in_review ?? 0) +
      (kycBy.action_required ?? 0) +
      (kycBy.verified ?? 0) +
      (kycBy.rejected ?? 0);
    return {
      weekly: weekly.map((w) => ({ week: w.week, total: Number(w.total) })),
      verifiedWeekly: verifiedWeekly.map((w) => ({
        week: w.week,
        total: Number(w.total),
      })),
      funnel: [
        { step: "Signed up", total: Number(userTotal) },
        { step: "Submitted identity", total: submitted },
        { step: "Verified", total: kycBy.verified ?? 0 },
      ],
      usage: usage.map((u) => ({
        type: u.type,
        total: Number(u.total),
        users: u.users,
        usdCents: Number(u.usdCents),
      })),
      waitlist: {
        total: Number(conversion.waitlist),
        joined: conversion.joined,
      },
      cards: Number(cards.total),
    };
  }

  async reportsCsv(adminId: string) {
    const r = await this.reports();
    await this.log(adminId, "reports.export");
    return csv(
      ["section", "label", "count", "extra"],
      [
        ...r.weekly.map((w) => ["signups_by_week", w.week, w.total, ""]),
        ...r.verifiedWeekly.map((w) => [
          "verified_by_week",
          w.week,
          w.total,
          "",
        ]),
        ...r.funnel.map((f) => ["funnel", f.step, f.total, ""]),
        ...r.usage.map((u) => [
          "product_usage",
          u.type,
          u.total,
          `${u.users} users; $${(u.usdCents / 100).toFixed(2)} simulated`,
        ]),
        ["waitlist", "total", r.waitlist.total, ""],
        ["waitlist", "created an account", r.waitlist.joined, ""],
      ],
    );
  }

  /* ---------- system status ---------- */

  async status() {
    const started = performance.now();
    let database: { ok: boolean; latencyMs: number; error?: string };
    try {
      await this.db.execute(sql`select 1`);
      database = {
        ok: true,
        latencyMs: Math.round(performance.now() - started),
      };
    } catch {
      database = {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        error: "Database did not respond.",
      };
    }
    const memory = process.memoryUsage();
    return {
      checkedAt: new Date().toISOString(),
      api: {
        ok: true,
        uptimeSeconds: Math.round(process.uptime()),
        node: process.version,
        environment: this.config.NODE_ENV,
        memoryMb: Math.round(memory.rss / 1_048_576),
      },
      database,
      email: {
        ok: Boolean(this.config.RESEND_API_KEY && this.config.EMAIL_FROM),
        provider: "Resend",
      },
      driver: this.config.DATABASE_DRIVER,
    };
  }

  /* ---------- global search ---------- */

  async search(raw?: string) {
    const q = term(raw);
    if (!q || q.length < 2) return { users: [], transactions: [], tickets: [] };
    const pattern = like(q);
    const number = /^#?t?-?(\d{1,9})$/i.exec(q)?.[1];
    const [found, tx, tickets] = await Promise.all([
      this.db
        .select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(users)
        .where(or(ilike(users.email, pattern), ilike(users.fullName, pattern)))
        .orderBy(desc(users.createdAt))
        .limit(5),
      this.db
        .select({
          id: demoLedger.id,
          description: demoLedger.description,
          reference: demoLedger.reference,
          usdCents: demoLedger.usdCents,
          userId: demoLedger.userId,
          email: users.email,
        })
        .from(demoLedger)
        .innerJoin(users, eq(users.id, demoLedger.userId))
        .where(
          or(
            ilike(demoLedger.reference, pattern),
            ilike(demoLedger.description, pattern),
          ),
        )
        .orderBy(desc(demoLedger.createdAt))
        .limit(5),
      this.db
        .select({
          id: supportTickets.id,
          number: supportTickets.number,
          subject: supportTickets.subject,
          status: supportTickets.status,
        })
        .from(supportTickets)
        .where(
          number
            ? or(
                eq(supportTickets.number, Number(number)),
                ilike(supportTickets.subject, pattern),
              )
            : ilike(supportTickets.subject, pattern),
        )
        .orderBy(desc(supportTickets.createdAt))
        .limit(5),
    ]);
    return { users: found, transactions: tx, tickets };
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
  @Allow("compliance")
  @HttpCode(200)
  suspend(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.suspend(req.userId, id, body);
  }

  @Post("users/:id/unsuspend")
  @Allow("compliance")
  @HttpCode(200)
  unsuspend(@Req() req: AdminRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.admin.unsuspend(req.userId, id);
  }

  @Post("users/:id/sign-out")
  @Allow("support")
  @HttpCode(200)
  signOut(@Req() req: AdminRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.admin.signOut(req.userId, id);
  }

  @Post("users/:id/password-reset")
  @Allow("support")
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
  @Allow("compliance")
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
  @Allow()
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
  @Allow("support")
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
  @Allow()
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

  @Get("me")
  @ApiOperation({ summary: "The signed-in admin's role" })
  me(@Req() req: AdminRequest) {
    return { role: req.adminRole };
  }

  @Get("tickets/:id")
  ticket(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.ticket(id);
  }

  @Post("tickets/:id/reply")
  @HttpCode(200)
  @Allow("support")
  @ApiOperation({ summary: "Reply to a ticket; the customer sees it" })
  reply(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.reply(req.userId, id, body);
  }

  @Get("users/:id/notes")
  notes(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.notes(id);
  }

  @Post("users/:id/notes")
  @HttpCode(200)
  @Allow("compliance", "support")
  addNote(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.addNote(req.userId, id, body);
  }

  @Get("announcements")
  announcements() {
    return this.admin.listAnnouncements();
  }

  @Post("announcements")
  @HttpCode(200)
  createAnnouncement(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.admin.createAnnouncement(req.userId, body);
  }

  @Post("announcements/:id")
  @HttpCode(200)
  setAnnouncement(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.setAnnouncement(req.userId, id, body);
  }

  @Get("team")
  team() {
    return this.admin.team();
  }

  @Post("team")
  @HttpCode(200)
  @ApiOperation({ summary: "Make an existing account an admin (owner only)" })
  addAdmin(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.admin.addAdmin(req.userId, body);
  }

  @Post("team/:id/role")
  @HttpCode(200)
  setRole(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.admin.setRole(req.userId, id, body);
  }

  @Post("team/:id/remove")
  @HttpCode(200)
  removeAdmin(
    @Req() req: AdminRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.admin.removeAdmin(req.userId, id);
  }

  @Get("reports")
  reports() {
    return this.admin.reports();
  }

  @Get("reports.csv")
  @Allow()
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="report.csv"')
  @Header("Cache-Control", "no-store")
  reportsCsv(@Req() req: AdminRequest) {
    return this.admin.reportsCsv(req.userId);
  }

  @Get("status")
  @ApiOperation({ summary: "API, database and email health" })
  status() {
    return this.admin.status();
  }

  @Get("search")
  @ApiOperation({ summary: "Find users, transactions and tickets" })
  search(@Query("q") q?: string) {
    return this.admin.search(q);
  }
}
