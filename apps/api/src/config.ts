import { z } from "zod";

const configSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    DATABASE_URL: z
      .url()
      .refine(
        (value) =>
          value.startsWith("postgres://") || value.startsWith("postgresql://"),
        "Must be a PostgreSQL URL",
      ),
    DATABASE_DRIVER: z.enum(["postgres", "neon-websocket"]).default("postgres"),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    PUBLIC_WEB_URL: z.url().default("http://localhost:3000"),
    RESEND_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().optional(),
    ),
    EMAIL_FROM: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.email().optional(),
    ),
    DEMO_MODE: z.literal("true").default("true"),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      !value.PUBLIC_WEB_URL.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        path: ["PUBLIC_WEB_URL"],
        message: "Production web origin must use HTTPS",
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function readConfig(input: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}
