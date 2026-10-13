import { z } from "zod";

const configSchema = z.object({
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
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
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
