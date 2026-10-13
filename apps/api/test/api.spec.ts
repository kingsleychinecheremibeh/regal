import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { AppModule } from "../src/app.module";
import { CONFIG } from "../src/db/database";
import { waitlist } from "../src/db/schema";

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
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (sql) {
      await drizzle(sql).delete(waitlist).where(eq(waitlist.email, email));
      await sql.end();
    }
    if (app) await app.close();
  });

  it("returns ready health and five planned products", async () => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "ok",
      service: "regalvest-api",
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
    expect(Object.keys(document.paths)).toEqual([
      "/api/v1/health",
      "/api/v1/products",
      "/api/v1/waitlist",
    ]);
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
});
