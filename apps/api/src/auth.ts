import { randomBytes, createHash } from "node:crypto";
import {
  argon2id,
  hash as hashPassword,
  verify as verifyPassword,
} from "argon2";
import {
  BadRequestException,
  Body,
  CanActivate,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppConfig } from "./config";
import { CONFIG, Database } from "./db/database";
import {
  authenticationSessions,
  demoBalances,
  emailVerificationTokens,
  passwordResetTokens,
  userPreferences,
  users,
} from "./db/schema";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128);
const registerInput = z
  .strictObject({
    fullName: z.string().trim().min(2).max(120),
    email,
    password,
    confirmPassword: z.string(),
    ageConfirmed: z.literal(true),
    termsAccepted: z.literal(true),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
  });
const loginInput = z.strictObject({ email, password: z.string() });
const tokenInput = z.strictObject({ token: z.string().min(20).max(200) });
const resetInput = tokenInput.extend({ password });
const profileInput = z.strictObject({
  fullName: z.string().trim().min(2).max(120),
});
const preferenceInput = z.strictObject({
  emailUpdates: z.boolean().optional(),
  demoAutoSave: z.boolean().optional(),
});
const changePasswordInput = z.strictObject({
  currentPassword: z.string(),
  newPassword: password,
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues[0]?.message ?? "Invalid input",
    );
  return result.data;
}
const token = () => randomBytes(32).toString("base64url");
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const cookieName = "regalvest_session";
const publicUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  emailVerifiedAt: user.emailVerifiedAt,
  provisionedAt: user.provisionedAt,
});
type AuthenticatedRequest = Request & { userId: string; sessionId: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  assertOrigin(req: Request): void {
    const origin = req.headers.origin;
    if (
      origin &&
      !this.config.CORS_ORIGINS.includes(origin) &&
      origin !== this.config.PUBLIC_WEB_URL
    )
      throw new ForbiddenException("Invalid request origin");
    if (!origin && req.headers.cookie)
      throw new ForbiddenException("Origin required");
  }

  private requireEmail(): void {
    if (!this.config.RESEND_API_KEY || !this.config.EMAIL_FROM)
      throw new ServiceUnavailableException("Email delivery is not configured");
  }

  private async sendEmail(
    to: string,
    subject: string,
    path: string,
    rawToken: string,
  ): Promise<void> {
    this.requireEmail();
    const url = `${this.config.PUBLIC_WEB_URL}${path}#token=${encodeURIComponent(rawToken)}`;
    let response: globalThis.Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          from: this.config.EMAIL_FROM,
          to: [to],
          subject,
          text: `Open this link to continue: ${url}\n\nIf you did not request this, ignore this message.`,
        }),
      });
    } catch {
      throw new ServiceUnavailableException("Email could not be delivered");
    }
    if (!response.ok)
      throw new ServiceUnavailableException("Email could not be delivered");
  }

  async register(body: unknown): Promise<{ message: string }> {
    const input = parse(registerInput, body);
    this.requireEmail();
    const existing = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing.length)
      throw new ConflictException("An account with this email already exists");
    const passwordHash = await hashPassword(input.password, { type: argon2id });
    let user: typeof users.$inferSelect;
    try {
      user = await this.database.db.transaction(async (tx) => {
        const rows = await tx
          .insert(users)
          .values({
            email: input.email,
            fullName: input.fullName,
            passwordHash,
            termsAcceptedAt: new Date(),
          })
          .returning();
        await tx.insert(userPreferences).values({ userId: rows[0].id });
        await tx.insert(demoBalances).values({ userId: rows[0].id });
        return rows[0];
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "23505"
      )
        throw new ConflictException(
          "An account with this email already exists",
        );
      throw error;
    }
    await this.issueEmailToken(user.id, user.email, "verify");
    return { message: "Account created. Check your email to verify it." };
  }

  private async issueEmailToken(
    userId: string,
    to: string,
    purpose: "verify" | "reset",
  ): Promise<void> {
    const rawToken = token();
    const expiresAt = new Date(
      Date.now() + (purpose === "verify" ? 24 : 1) * 60 * 60 * 1000,
    );
    const table =
      purpose === "verify" ? emailVerificationTokens : passwordResetTokens;
    await this.database.db
      .insert(table)
      .values({ userId, tokenHash: digest(rawToken), expiresAt });
    await this.sendEmail(
      to,
      purpose === "verify"
        ? "Verify your Regalvest account"
        : "Reset your Regalvest password",
      purpose === "verify" ? "/verify" : "/reset-password",
      rawToken,
    );
  }

  async resend(body: unknown): Promise<{ message: string }> {
    const { email: address } = parse(z.strictObject({ email }), body);
    this.requireEmail();
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, address))
      .limit(1);
    if (rows[0] && !rows[0].emailVerifiedAt) {
      try {
        await this.issueEmailToken(rows[0].id, address, "verify");
      } catch {
        this.logger.warn({ event: "verification_email_delivery_failed" });
      }
    }
    return { message: "If verification is needed, an email has been sent." };
  }

  async forgot(body: unknown): Promise<{ message: string }> {
    const { email: address } = parse(z.strictObject({ email }), body);
    this.requireEmail();
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, address))
      .limit(1);
    if (rows[0]) {
      try {
        await this.issueEmailToken(rows[0].id, address, "reset");
      } catch {
        this.logger.warn({ event: "reset_email_delivery_failed" });
      }
    }
    return { message: "If the account exists, a reset email has been sent." };
  }

  async verify(body: unknown): Promise<{ message: string }> {
    const { token: rawToken } = parse(tokenInput, body);
    await this.database.db.transaction(async (tx) => {
      const rows = await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, digest(rawToken)),
            isNull(emailVerificationTokens.consumedAt),
            gt(emailVerificationTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!rows[0])
        throw new BadRequestException("Invalid or expired verification link");
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, rows[0].userId));
    });
    return { message: "Email verified. You can now sign in." };
  }

  async reset(body: unknown): Promise<{ message: string }> {
    const input = parse(resetInput, body);
    const passwordHash = await hashPassword(input.password, { type: argon2id });
    await this.database.db.transaction(async (tx) => {
      const rows = await tx
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, digest(input.token)),
            isNull(passwordResetTokens.consumedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!rows[0])
        throw new BadRequestException("Invalid or expired reset link");
      await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, rows[0].userId));
      await tx
        .update(authenticationSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authenticationSessions.userId, rows[0].userId));
    });
    return { message: "Password changed. Sign in again." };
  }

  async login(
    body: unknown,
    res: Response,
  ): Promise<{ user: ReturnType<typeof publicUser> }> {
    const input = parse(loginInput, body);
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    const user = rows[0];
    if (!user || !(await verifyPassword(user.passwordHash, input.password)))
      throw new UnauthorizedException("Invalid email or password");
    if (!user.emailVerifiedAt && !user.provisionedAt)
      throw new ForbiddenException("Verify your email before signing in");
    const rawToken = token();
    await this.database.db.insert(authenticationSessions).values({
      userId: user.id,
      tokenHash: digest(rawToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    res.cookie(cookieName, rawToken, {
      httpOnly: true,
      secure: this.config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400000,
    });
    return { user: publicUser(user) };
  }

  async authenticate(
    req: Request,
  ): Promise<{ userId: string; sessionId: string }> {
    const rawToken = req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!rawToken) throw new UnauthorizedException();
    const rows = await this.database.db
      .select()
      .from(authenticationSessions)
      .where(
        and(
          eq(authenticationSessions.tokenHash, digest(rawToken)),
          isNull(authenticationSessions.revokedAt),
          gt(authenticationSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new UnauthorizedException();
    return { userId: rows[0].userId, sessionId: rows[0].id };
  }

  async me(userId: string) {
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!rows[0]) throw new UnauthorizedException();
    return publicUser(rows[0]);
  }

  async logout(sessionId: string, res: Response): Promise<void> {
    await this.database.db
      .update(authenticationSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authenticationSessions.id, sessionId));
    res.clearCookie(cookieName, { path: "/" });
  }

  async logoutAll(userId: string, res: Response): Promise<void> {
    await this.database.db
      .update(authenticationSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authenticationSessions.userId, userId));
    res.clearCookie(cookieName, { path: "/" });
  }

  sessions(userId: string) {
    return this.database.db
      .select({
        id: authenticationSessions.id,
        createdAt: authenticationSessions.createdAt,
        expiresAt: authenticationSessions.expiresAt,
      })
      .from(authenticationSessions)
      .where(
        and(
          eq(authenticationSessions.userId, userId),
          isNull(authenticationSessions.revokedAt),
          gt(authenticationSessions.expiresAt, new Date()),
        ),
      );
  }
  async revoke(userId: string, id: string) {
    await this.database.db
      .update(authenticationSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authenticationSessions.id, id),
          eq(authenticationSessions.userId, userId),
        ),
      );
  }
  async profile(userId: string, body: unknown) {
    const input = parse(profileInput, body);
    const rows = await this.database.db
      .update(users)
      .set(input)
      .where(eq(users.id, userId))
      .returning();
    return publicUser(rows[0]);
  }
  async preferences(userId: string) {
    const rows = await this.database.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return rows[0];
  }
  async updatePreferences(userId: string, body: unknown) {
    const input = parse(preferenceInput, body);
    const rows = await this.database.db
      .update(userPreferences)
      .set(input)
      .where(eq(userPreferences.userId, userId))
      .returning();
    return rows[0];
  }
  async changePassword(userId: string, body: unknown) {
    const input = parse(changePasswordInput, body);
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    if (
      !rows[0] ||
      !(await verifyPassword(rows[0].passwordHash, input.currentPassword))
    )
      throw new ForbiddenException("Current password is incorrect");
    const passwordHash = await hashPassword(input.newPassword, {
      type: argon2id,
    });
    await this.database.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
    await this.database.db
      .update(authenticationSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authenticationSessions.userId, userId));
    return { message: "Password updated. Sign in again." };
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(
    context: import("@nestjs/common").ExecutionContext,
  ): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
      this.auth.assertOrigin(req);
    const session = await this.auth.authenticate(req);
    req.userId = session.userId;
    req.sessionId = session.sessionId;
    return true;
  }
}

@ApiTags("Authentication")
@ApiBadRequestResponse({ description: "Invalid or expired input" })
@ApiTooManyRequestsResponse({ description: "Too many attempts from this IP" })
@Controller("api/v1/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("register")
  @ApiOperation({
    summary: "Create a real account and send a verification email",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "fullName",
        "email",
        "password",
        "confirmPassword",
        "ageConfirmed",
        "termsAccepted",
      ],
      properties: {
        fullName: { type: "string", example: "Ada Example" },
        email: { type: "string", format: "email", example: "ada@example.com" },
        password: { type: "string", format: "password", minLength: 12 },
        confirmPassword: { type: "string", format: "password" },
        ageConfirmed: { type: "boolean", example: true },
        termsAccepted: { type: "boolean", example: true },
      },
    },
  })
  @ApiConflictResponse({ description: "Account already exists" })
  @ApiServiceUnavailableResponse({
    description: "Email delivery is not configured or unavailable",
  })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() body: unknown) {
    return this.auth.register(body);
  }
  @Post("login")
  @ApiOperation({ summary: "Sign in and set an HttpOnly session cookie" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", format: "password" },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @ApiForbiddenResponse({ description: "Email is not verified" })
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.auth.assertOrigin(req);
    return this.auth.login(body, res);
  }
  @Post("verify-email")
  @ApiOperation({ summary: "Consume a single-use email verification token" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["token"],
      properties: {
        token: { type: "string", example: "opaque-token-from-email-link" },
      },
    },
  })
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verify(@Body() body: unknown) {
    return this.auth.verify(body);
  }
  @Post("resend-verification")
  @ApiBody({
    schema: {
      type: "object",
      required: ["email"],
      properties: { email: { type: "string", format: "email" } },
    },
  })
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resend(@Body() body: unknown) {
    return this.auth.resend(body);
  }
  @Post("forgot-password")
  @ApiOperation({
    summary:
      "Request a reset email; response is generic for existing and missing accounts",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email"],
      properties: { email: { type: "string", format: "email" } },
    },
  })
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgot(@Body() body: unknown) {
    return this.auth.forgot(body);
  }
  @Post("reset-password")
  @ApiOperation({ summary: "Consume a reset token and revoke all sessions" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["token", "password"],
      properties: {
        token: { type: "string" },
        password: { type: "string", format: "password", minLength: 12 },
      },
    },
  })
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  reset(@Body() body: unknown) {
    return this.auth.reset(body);
  }
  @Get("me") @UseGuards(SessionGuard) me(@Req() req: AuthenticatedRequest) {
    return this.auth.me(req.userId);
  }
  @Get("sessions") @UseGuards(SessionGuard) sessions(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.auth.sessions(req.userId);
  }
  @Delete("sessions/:id") @UseGuards(SessionGuard) revoke(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.auth.revoke(req.userId, id);
  }
  @Post("logout") @HttpCode(200) @UseGuards(SessionGuard) async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.sessionId, res);
    return { message: "Signed out" };
  }
  @Post("logout-all") @HttpCode(200) @UseGuards(SessionGuard) async logoutAll(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(req.userId, res);
    return { message: "All sessions revoked" };
  }
  @Post("refresh") @HttpCode(200) @UseGuards(SessionGuard) refresh(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.auth.me(req.userId);
  }
}

@ApiTags("User profile")
@ApiCookieAuth("regalvest_session")
@ApiUnauthorizedResponse({ description: "Valid session required" })
@Controller("api/v1/users/me")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Get() get(@Req() req: AuthenticatedRequest) {
    return this.auth.me(req.userId);
  }
  @Patch() patch(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.auth.profile(req.userId, body);
  }
  @Patch("password") password(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.auth.changePassword(req.userId, body);
  }
  @Get("preferences") preferences(@Req() req: AuthenticatedRequest) {
    return this.auth.preferences(req.userId);
  }
  @Patch("preferences") patchPreferences(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.auth.updatePreferences(req.userId, body);
  }
}
