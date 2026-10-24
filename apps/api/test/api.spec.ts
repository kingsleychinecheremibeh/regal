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
    expect(
      (
        await call("POST", "demo/verification/kyc/review", cookie, {
          decision: "rejected",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "demo/verification/kyc/review", cookie, {
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
