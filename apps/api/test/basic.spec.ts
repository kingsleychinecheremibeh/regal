import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config";
import { products } from "../src/products";

describe("public MVP configuration and catalog", () => {
  it("requires a PostgreSQL URL and an allowed web origin", () => {
    expect(() => readConfig({})).toThrow("Invalid environment");
    expect(() =>
      readConfig({
        DATABASE_URL: "https://example.com",
        CORS_ORIGINS: "http://localhost:3000",
      }),
    ).toThrow("Invalid environment");
    expect(
      readConfig({
        DATABASE_URL: "postgresql://localhost/regalvest",
        CORS_ORIGINS: "http://localhost:3000",
      }).CORS_ORIGINS,
    ).toEqual(["http://localhost:3000"]);
  });

  it("marks every published product category as planned", () => {
    expect(products).toHaveLength(5);
    expect(products.every((product) => product.status === "planned")).toBe(
      true,
    );
  });
});
