import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { AppModule } from "../src/app.module";
import { CONFIG } from "../src/db/database";
import { emailVerificationTokens, users, waitlist } from "../src/db/schema";
import { provisionAccount } from "../src/provisioning";

const testUrl = process.env.TEST_DATABASE_URL;
const integration =
  testUrl && /(^|[/_-])test([/_-]|$)/i.test(new URL(testUrl).pathname)
    ? describe
    : describe.skip;

integration("Regalvest API with isolated PostgreSQL", () => {
  let app: INestApplication;
  let baseUrl: string;
  let sql: ReturnType<typeof postgres>;
  const email = `mvp-${Date.now()}@example.com`;
  const accountEmail = `auth-${Date.now()}@example.com`;
  const otherEmail = `other-${Date.now()}@example.com`;
  const provisionEmail = `provision-${Date.now()}@example.com`;
  const originalFetch = globalThis.fetch;
  const mailLinks: string[] = [];

  beforeAll(async () => {
    sql = postgres(testUrl!);
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue({
        NODE_ENV: "test",
        PORT: 0,
        DATABASE_URL: testUrl,
        CORS_ORIGINS: ["http://localhost:3000"],
        PUBLIC_WEB_URL: "http://localhost:3000",
        RESEND_API_KEY: "test-key",
        EMAIL_FROM: "demo@example.com",
        DEMO_MODE: "true",
      })
      .compile();
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      if (String(input) === "https://api.resend.com/emails") {
        const payload = JSON.parse(String(init?.body)) as { text: string };
        mailLinks.push(payload.text);
        return new Response(JSON.stringify({ id: "test-email" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (sql) {
      await drizzle(sql).delete(waitlist).where(eq(waitlist.email, email));
      await drizzle(sql).delete(users).where(eq(users.email, accountEmail));
      await drizzle(sql).delete(users).where(eq(users.email, otherEmail));
      await drizzle(sql).delete(users).where(eq(users.email, provisionEmail));
      await sql.end();
    }
    if (app) await app.close();
  });

  it("returns ready health and five planned products", async () => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "ok",
      service: "turboxglobal-api",
    });
    const products = await fetch(`${baseUrl}/api/v1/products`);
    expect(products.status).toBe(200);
    const body = (await products.json()) as Array<{ status: string }>;
    expect(body).toHaveLength(5);
    expect(body.every((product) => product.status === "planned")).toBe(true);
  });

  it("generates documentation for the implemented routes", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Regalvest API").setVersion("1.0").build(),
    );
    expect(Object.keys(document.paths)).toContain("/api/v1/auth/register");
    expect(Object.keys(document.paths)).toContain("/api/v1/demo/overview");
    expect(Object.keys(document.paths)).toContain("/api/v1/contact");
    expect(
      document.paths["/api/v1/auth/register"].post?.requestBody,
    ).toBeDefined();
    expect(
      document.paths["/api/v1/demo/trades"].post?.requestBody,
    ).toBeDefined();
    expect(document.paths["/api/v1/waitlist"].post?.requestBody).toBeDefined();
  });

  it("validates consent and persists a normalized email only once", async () => {
    const submit = (body: unknown) =>
      fetch(`${baseUrl}/api/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await submit({ email, consent: false })).status).toBe(400);
    expect((await submit({ email: "invalid", consent: true })).status).toBe(
      400,
    );
    const first = await submit({
      email: `  ${email.toUpperCase()}  `,
      consent: true,
    });
    expect(first.status).toBe(200);
    const duplicate = await submit({ email, consent: true });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual(await first.json());
    const rows = await drizzle(sql)
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].consentAt).toBeInstanceOf(Date);
  });

  it("limits repeated waitlist requests from the same client", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await fetch(`${baseUrl}/api/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid", consent: false }),
      });
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  });

  it("provisions a private account without email and revokes sessions on operator reset", async () => {
    const privateModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CONFIG)
      .useValue({
        NODE_ENV: "test",
        PORT: 0,
        DATABASE_URL: testUrl,
        CORS_ORIGINS: ["http://localhost:3000"],
        PUBLIC_WEB_URL: "http://localhost:3000",
        DEMO_MODE: "true",
      })
      .compile();
    const privateApp = privateModule.createNestApplication();
    await privateApp.listen(0, "127.0.0.1");
    const privateBase = await privateApp.getUrl();
    try {
      await expect(
        provisionAccount({
          databaseUrl: testUrl!,
          action: "provision",
          email: provisionEmail,
          fullName: "Private Investor",
          password: "InitialSecretPassword123!",
        }),
      ).rejects.toThrow("Age and Terms confirmation is required");
      await provisionAccount({
        databaseUrl: testUrl!,
        action: "provision",
        email: provisionEmail.toUpperCase(),
        fullName: "Private Investor",
        password: "InitialSecretPassword123!",
        ageAndTermsConfirmed: true,
      });
      await expect(
        provisionAccount({
          databaseUrl: testUrl!,
          action: "provision",
          email: provisionEmail,
          fullName: "Private Investor",
          password: "InitialSecretPassword123!",
          ageAndTermsConfirmed: true,
        }),
      ).rejects.toThrow("Account already exists");
      const signIn = (password: string) =>
        fetch(`${privateBase}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: provisionEmail, password }),
        });
      expect((await signIn("wrong")).status).toBe(401);
      const first = await signIn("InitialSecretPassword123!");
      expect(first.status).toBe(200);
      const cookie = first.headers.get("set-cookie")!.split(";")[0];
      const before = await fetch(`${privateBase}/api/v1/auth/me`, {
        headers: { Cookie: cookie },
      });
      expect(before.status).toBe(200);
      expect(await before.json()).toMatchObject({
        email: provisionEmail,
        emailVerifiedAt: null,
        provisionedAt: expect.any(String),
      });
      await provisionAccount({
        databaseUrl: testUrl!,
        action: "reset",
        email: provisionEmail,
        password: "ReplacementPassword123!",
      });
      const after = await fetch(`${privateBase}/api/v1/auth/me`, {
        headers: { Cookie: cookie },
      });
      expect(after.status).toBe(401);
      expect((await signIn("InitialSecretPassword123!")).status).toBe(401);
      expect((await signIn("ReplacementPassword123!")).status).toBe(200);
    } finally {
      await privateApp.close();
    }
  });

  it("registers, verifies, authenticates, isolates demo data and resets a password", async () => {
    const post = (
      path: string,
      body: object,
      cookie?: string,
      idempotencyKey?: string,
    ) =>
      fetch(`${baseUrl}/api/v1/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });
    const register = (address: string) =>
      post("auth/register", {
        fullName: "Test Investor",
        email: address,
        password: "VerySecurePassword123!",
        confirmPassword: "VerySecurePassword123!",
        ageConfirmed: true,
        termsAccepted: true,
      });
    expect((await register(accountEmail)).status).toBe(201);
    expect((await register(accountEmail)).status).toBe(409);
    expect((await post("auth/register", { email: "wrong" })).status).toBe(400);
    const firstToken = new URLSearchParams(
      mailLinks.at(-1)?.split("#")[1]?.split("\n")[0],
    ).get("token")!;
    expect(
      (await post("auth/login", { email: accountEmail, password: "wrong" }))
        .status,
    ).toBe(401);
    expect(
      (
        await post("auth/login", {
          email: accountEmail,
          password: "VerySecurePassword123!",
        })
      ).status,
    ).toBe(403);
    expect(
      (await post("auth/verify-email", { token: firstToken })).status,
    ).toBe(200);
    expect(
      (await post("auth/verify-email", { token: firstToken })).status,
    ).toBe(400);
    const login = await post("auth/login", {
      email: accountEmail,
      password: "VerySecurePassword123!",
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    expect(cookie).toContain("regalvest_session=");
    expect((await fetch(`${baseUrl}/api/v1/demo/overview`)).status).toBe(401);
    const current = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookie },
    });
    expect((await current.json()).email).toBe(accountEmail);

    expect((await register(otherEmail)).status).toBe(201);
    const expiredToken = new URLSearchParams(
      mailLinks.at(-1)?.split("#")[1]?.split("\n")[0],
    ).get("token")!;
    await drizzle(sql)
      .update(emailVerificationTokens)
      .set({ expiresAt: new Date(0) })
      .where(
        eq(
          emailVerificationTokens.tokenHash,
          createHash("sha256").update(expiredToken).digest("hex"),
        ),
      );
    expect(
      (await post("auth/verify-email", { token: expiredToken })).status,
    ).toBe(400);
    expect(
      (await post("auth/resend-verification", { email: otherEmail })).status,
    ).toBe(200);
    const secondToken = new URLSearchParams(
      mailLinks.at(-1)?.split("#")[1]?.split("\n")[0],
    ).get("token")!;
    expect(
      (await post("auth/verify-email", { token: secondToken })).status,
    ).toBe(200);
    const otherLogin = await post("auth/login", {
      email: otherEmail,
      password: "VerySecurePassword123!",
    });
    const otherCookie = otherLogin.headers.get("set-cookie")!.split(";")[0];

    const call = async (
      method: string,
      path: string,
      who: string,
      body?: object,
      key?: string,
    ) => {
      const response = await fetch(`${baseUrl}/api/v1/${path}`, {
        method,
        headers: {
          Origin: "http://localhost:3000",
          Cookie: who,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      const json = text.startsWith("{") || text.startsWith("[");
      return {
        status: response.status,
        text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: (json ? JSON.parse(text) : {}) as any,
      };
    };
    type Holding = { asset: string; quantity: number };
    const holdings = async (who: string): Promise<Record<string, number>> =>
      Object.fromEntries(
        (
          (await call("GET", "demo/overview", who)).body.holdings as Holding[]
        ).map((h) => [h.asset, h.quantity]),
      );

    // Products stay locked until KYC is approved.
    const state = await call("GET", "demo/state", cookie);
    expect(state.status).toBe(200);
    expect(state.body.verification).toMatchObject({
      kyc: { status: "not_started" },
      kyb: null,
    });
    expect(
      (
        await call(
          "POST",
          "demo/trades",
          cookie,
          { side: "buy", symbol: "BTC", quantity: "0.01" },
          "locked-trade-0001",
        )
      ).status,
    ).toBe(403);
    expect(await holdings(cookie)).toEqual({});

    // KYC: steps are validated, document numbers are masked, then reviewed.
    expect(
      (await call("POST", "demo/verification/kyc/submit", cookie)).status,
    ).toBe(400);
    const file = { name: "sample.pdf", type: "application/pdf", size: 1000 };
    expect(
      (
        await call("PUT", "demo/verification/kyc/document", cookie, {
          type: "passport",
          country: "Nigeria",
          number: "A12345678",
          file,
        })
      ).status,
    ).toBe(200);
    await call("PUT", "demo/verification/kyc/selfie", cookie, {
      method: "sample",
    });
    await call("PUT", "demo/verification/kyc/questionnaire", cookie, {
      occupation: "Analyst",
      sourceOfFunds: "salary",
      purpose: "all",
      politicallyExposed: false,
    });
    const draft = await call("GET", "demo/verification", cookie);
    expect(draft.text).not.toContain("A12345678");
    expect(
      (await call("POST", "demo/verification/kyc/submit", cookie)).status,
    ).toBe(200);
    // Only admins decide cases; the customer cannot approve their own.
    expect((await call("GET", "admin/verifications", cookie)).status).toBe(403);
    const [account] = await drizzle(sql)
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.email, accountEmail))
      .returning({ id: users.id });
    const queue = await call("GET", "admin/verifications", cookie);
    expect(queue.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: account.id, kind: "kyc" }),
      ]),
    );
    expect(
      (
        await call("POST", `admin/verifications/${account.id}/kyc`, cookie, {
          decision: "rejected",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", `admin/verifications/${account.id}/kyc`, cookie, {
          decision: "verified",
        })
      ).status,
    ).toBe(200);
    const funded = await holdings(cookie);
    expect(funded.USD).toBe(12480.55);
    expect(funded.BTC).toBe(0.0842);

    // A buy debits USD with the 0.5% fee and credits the asset once per key.
    const buy = { side: "buy", symbol: "ETH", quantity: "0.5" };
    expect(
      (await call("POST", "demo/trades", cookie, buy, "buy-test-0001")).status,
    ).toBe(200);
    expect(
      (await call("POST", "demo/trades", cookie, buy, "buy-test-0001")).body,
    ).toMatchObject({ duplicate: true });
    const afterBuy = await holdings(cookie);
    expect(afterBuy.ETH).toBe(1.85);
    expect(afterBuy.USD).toBeCloseTo(12480.55 - 1560.38 - 7.8, 2);

    // Invalid swaps and oversells are refused.
    expect(
      (
        await call(
          "POST",
          "demo/trades",
          cookie,
          { side: "swap", from: "SOL", to: "SOL", quantity: "1" },
          "swap-test-0001",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          "POST",
          "demo/trades",
          cookie,
          { side: "sell", symbol: "BTC", quantity: "5" },
          "sell-test-0001",
        )
      ).status,
    ).toBe(400);

    // Payments: concurrent duplicates create one ledger row; over-limit fails.
    const beneficiary = await call("POST", "demo/beneficiaries", cookie, {
      name: "Anna Keller",
      country: "Germany",
      currency: "EUR",
      account: "DE89 3704 0044 0532 0130 00",
    });
    expect(beneficiary.status).toBe(201);
    expect(beneficiary.body.accountLast4).toBe("3000");
    const payment = {
      kind: "transfer",
      beneficiaryId: beneficiary.body.id,
      currency: "USD",
      amount: "100",
    };
    const concurrent = await Promise.all([
      call("POST", "demo/payments", cookie, payment, "pay-test-0001"),
      call("POST", "demo/payments", cookie, payment, "pay-test-0001"),
    ]);
    expect(concurrent.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (await call("GET", "demo/transactions?type=transfer", cookie)).body.total,
    ).toBe(1);
    const overLimit = await call(
      "POST",
      "demo/payments",
      cookie,
      { ...payment, amount: "6000" },
      "pay-test-0002",
    );
    expect(overLimit.body).toMatchObject({ status: "failed" });
    expect((await holdings(cookie)).USD).toBeCloseTo(afterBuy.USD - 101, 2);

    // Another user cannot see or use this user's records.
    expect(
      (
        await call(
          "DELETE",
          `demo/beneficiaries/${beneficiary.body.id}`,
          otherCookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (await call("POST", "demo/payments/quote", otherCookie, payment)).status,
    ).toBe(404);
    const otherCsv = await call(
      "GET",
      "demo/transactions/export.csv",
      otherCookie,
    );
    expect(otherCsv.status).toBe(200);
    expect(otherCsv.text).not.toContain("Anna Keller");
    const csv = await call("GET", "demo/transactions/export.csv", cookie);
    expect(csv.text).toContain("Transfer to Anna Keller");

    // Cards: frozen cards decline simulated purchases.
    const card = await call("POST", "demo/cards", cookie, { label: "Online" });
    expect(card.status).toBe(201);
    await call("PATCH", `demo/cards/${card.body.id}`, cookie, {
      frozen: true,
    });
    const declined = await call(
      "POST",
      `demo/cards/${card.body.id}/purchase`,
      cookie,
      undefined,
      "purchase-test-0001",
    );
    expect(declined.body).toMatchObject({ status: "failed" });
    expect(
      (
        await call("PATCH", `demo/cards/${card.body.id}`, otherCookie, {
          frozen: false,
        })
      ).status,
    ).toBe(404);

    // Statements are generated from the ledger.
    const month = new Date().toISOString().slice(0, 7);
    const statement = await call(
      "GET",
      `demo/statements/${month}?account=USD&format=csv`,
      cookie,
    );
    expect(statement.status).toBe(200);
    expect(statement.text).toContain("Opening demo balance (USD)");

    // Fiat Acquiring needs a business account and an approved KYB case.
    expect((await call("GET", "demo/acquiring", cookie)).status).toBe(403);
    await call("PATCH", "demo/profile", cookie, {
      accountType: "business",
      businessName: "Test Ltd",
    });
    expect((await call("GET", "demo/acquiring", cookie)).status).toBe(403);
    expect(
      (await call("GET", "demo/verification", cookie)).body.kyb,
    ).toMatchObject({ status: "not_started" });

    // Resetting balances keeps verification and restores opening funds.
    expect((await call("POST", "demo/reset", cookie, {})).status).toBe(200);
    expect((await holdings(cookie)).USD).toBe(12480.55);
    expect((await call("GET", "demo/transactions", cookie)).body.total).toBe(7);

    // Admin console: overview, search, detail, exports, moderation, audit.
    const overview = await call("GET", "admin/overview", cookie);
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({
      users: { total: expect.any(Number), admins: expect.any(Number) },
      transactions: { total: expect.any(Number) },
      verification: { kyc: expect.any(Object) },
    });
    expect(Array.isArray(overview.body.signups)).toBe(true);
    const found = await call(
      "GET",
      `admin/users?search=${encodeURIComponent(otherEmail)}`,
      cookie,
    );
    expect(found.body.total).toBe(1);
    const otherId = found.body.rows[0].id as string;
    const admins = await call("GET", "admin/users?filter=admins", cookie);
    expect(
      admins.body.rows.some((u: { email: string }) => u.email === accountEmail),
    ).toBe(true);
    const detail = await call("GET", `admin/users/${account.id}`, cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "kyc", status: "verified" }),
      ]),
    );
    expect(detail.body.ledger.length).toBeGreaterThan(0);
    expect((await call("GET", "admin/users/not-a-uuid", cookie)).status).toBe(
      400,
    );
    const ledger = await call(
      "GET",
      `admin/transactions?search=${encodeURIComponent(accountEmail)}`,
      cookie,
    );
    expect(ledger.body.total).toBeGreaterThan(0);
    const exported = await call("GET", "admin/transactions.csv", cookie);
    expect(exported.status).toBe(200);
    expect(String(exported.text).split("\n")[0]).toBe(
      "date,email,type,status,description,reference,currency,usd",
    );
    expect(
      (await call("POST", `admin/users/${account.id}/suspend`, cookie, {}))
        .status,
    ).toBe(400);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/admin/users/${otherId}/suspend`, {
          method: "POST",
          headers: { Cookie: cookie, Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("POST", `admin/users/${otherId}/suspend`, cookie, {
          reason: "Test",
        })
      ).status,
    ).toBe(200);
    expect((await call("GET", "auth/me", otherCookie)).status).toBe(401);
    expect(
      (await call("GET", "admin/users?filter=suspended", cookie)).body.total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      (await call("POST", `admin/users/${otherId}/unsuspend`, cookie, {}))
        .status,
    ).toBe(200);
    expect(
      (await call("POST", `admin/users/${otherId}/sign-out`, cookie, {}))
        .status,
    ).toBe(200);
    expect((await call("GET", "admin/tickets", cookie)).status).toBe(200);
    expect(
      (
        await call(
          "POST",
          "admin/tickets/00000000-0000-4000-8000-000000000000/status",
          cookie,
          { status: "resolved" },
        )
      ).status,
    ).toBe(404);
    expect((await call("GET", "admin/messages", cookie)).status).toBe(200);
    expect((await call("GET", "admin/waitlist", cookie)).status).toBe(200);
    const audit = await call("GET", "admin/audit", cookie);
    expect(audit.body.rows.map((r: { action: string }) => r.action)).toEqual(
      expect.arrayContaining([
        "verification.verified",
        "user.suspend",
        "user.unsuspend",
        "user.sign_out_all",
        "transactions.export",
      ]),
    );

    // Ticket conversation: the customer opens, staff reply, customer sees it.
    const opened = await call("POST", "demo/tickets", cookie, {
      subject: "Card question",
      body: "How do I freeze a card?",
    });
    const ticketId = opened.body.id as string;
    expect(
      (
        await call("POST", `admin/tickets/${ticketId}/reply`, cookie, {
          body: "Open Cards and press Freeze.",
        })
      ).status,
    ).toBe(200);
    const thread = await call("GET", `demo/tickets/${ticketId}`, cookie);
    expect(thread.body.ticket.status).toBe("pending");
    expect(thread.body.messages).toEqual([
      expect.objectContaining({ fromStaff: true }),
    ]);
    expect(
      (
        await call("POST", `demo/tickets/${ticketId}/reply`, cookie, {
          body: "Thanks, done.",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("GET", `admin/tickets/${ticketId}`, cookie)).body.messages,
    ).toHaveLength(2);

    // Staff notes, announcements, team, reports, status and search.
    expect(
      (
        await call("POST", `admin/users/${otherId}/notes`, cookie, {
          body: "Called about documents.",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("GET", `admin/users/${otherId}/notes`, cookie)).body[0].body,
    ).toBe("Called about documents.");
    expect(
      (
        await call("POST", "admin/announcements", cookie, {
          title: "Maintenance tonight",
          body: "Short downtime at 10pm.",
          tone: "warning",
        })
      ).status,
    ).toBe(200);
    const banners = await call("GET", "demo/announcements", cookie);
    expect(banners.body[0]).toMatchObject({ title: "Maintenance tonight" });
    expect(
      (
        await call(
          "POST",
          `admin/announcements/${banners.body[0].id}`,
          cookie,
          {
            active: false,
          },
        )
      ).status,
    ).toBe(200);
    expect((await call("GET", "demo/announcements", cookie)).body).toEqual([]);
    const team = await call("GET", "admin/team", cookie);
    expect(team.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: accountEmail }),
      ]),
    );
    expect(
      (
        await call("POST", `admin/team/${account.id}/role`, cookie, {
          role: "viewer",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "admin/team", cookie, {
          email: otherEmail,
          role: "viewer",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("POST", `admin/team/${otherId}/role`, cookie, {
          role: "support",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("POST", `admin/team/${otherId}/remove`, cookie, {})).status,
    ).toBe(200);
    expect(
      (await call("POST", `admin/team/${account.id}/remove`, cookie, {}))
        .status,
    ).toBe(400);
    const reports = await call("GET", "admin/reports", cookie);
    expect(reports.body.funnel[0]).toMatchObject({ step: "Signed up" });
    expect(reports.body.usage.length).toBeGreaterThan(0);
    const health = await call("GET", "admin/status", cookie);
    expect(health.body.database.ok).toBe(true);
    const hits = await call(
      "GET",
      `admin/search?q=${encodeURIComponent(accountEmail)}`,
      cookie,
    );
    expect(hits.body.users[0]).toMatchObject({ email: accountEmail });
    expect((await call("GET", "admin/me", cookie)).body.role).toBe("owner");
    // A viewer can read but not act; support can reply but not suspend.
    await drizzle(sql)
      .update(users)
      .set({ adminRole: "viewer" })
      .where(eq(users.id, account.id));
    expect((await call("GET", "admin/overview", cookie)).status).toBe(200);
    expect(
      (
        await call("POST", `admin/users/${otherId}/notes`, cookie, {
          body: "Not allowed",
        })
      ).status,
    ).toBe(403);
    expect((await call("GET", "admin/waitlist.csv", cookie)).status).toBe(403);
    await drizzle(sql)
      .update(users)
      .set({ adminRole: "support" })
      .where(eq(users.id, account.id));
    expect(
      (
        await call("POST", `admin/tickets/${ticketId}/reply`, cookie, {
          body: "Support can reply.",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("POST", `admin/users/${otherId}/suspend`, cookie, {})).status,
    ).toBe(403);
    await drizzle(sql)
      .update(users)
      .set({ adminRole: "owner" })
      .where(eq(users.id, account.id));

    expect(
      (await post("auth/forgot-password", { email: accountEmail })).status,
    ).toBe(200);
    const resetToken = new URLSearchParams(
      mailLinks.at(-1)?.split("#")[1]?.split("\n")[0],
    ).get("token")!;
    expect(
      (
        await post("auth/reset-password", {
          token: resetToken,
          password: "NewSecurePassword123!",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post("auth/reset-password", {
          token: resetToken,
          password: "NewSecurePassword123!",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/auth/me`, {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post("auth/login", {
          email: accountEmail,
          password: "NewSecurePassword123!",
        })
      ).status,
    ).toBe(200);
  });
});
