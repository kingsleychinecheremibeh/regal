import { argon2id, hash } from "argon2";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";
import {
  authenticationSessions,
  demoBalances,
  userPreferences,
  users,
} from "./db/schema";

const emailSchema = z.email().max(254);
const nameSchema = z.string().trim().min(2).max(120);
const passwordSchema = z.string().min(12).max(128);

export async function provisionAccount(input: {
  databaseUrl: string;
  action: "provision" | "reset";
  email: string;
  fullName?: string;
  password: string;
  ageAndTermsConfirmed?: boolean;
}): Promise<void> {
  const email = emailSchema.parse(input.email.trim().toLowerCase());
  const fullName =
    input.action === "provision" ? nameSchema.parse(input.fullName) : undefined;
  if (input.action === "provision" && !input.ageAndTermsConfirmed)
    throw new Error("Age and Terms confirmation is required");
  const passwordHash = await hash(passwordSchema.parse(input.password), {
    type: argon2id,
  });
  const client = postgres(input.databaseUrl, { max: 1 });
  try {
    const db = drizzle(client);
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (input.action === "provision") {
        if (existing.length) throw new Error("Account already exists");
        const [account] = await tx
          .insert(users)
          .values({
            email,
            fullName: fullName!,
            passwordHash,
            provisionedAt: new Date(),
            termsAcceptedAt: new Date(),
          })
          .returning({ id: users.id });
        await tx.insert(userPreferences).values({ userId: account.id });
        await tx.insert(demoBalances).values({ userId: account.id });
      } else {
        if (!existing.length) throw new Error("Account not found");
        await tx
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, existing[0].id));
        await tx
          .update(authenticationSessions)
          .set({ revokedAt: new Date() })
          .where(eq(authenticationSessions.userId, existing[0].id));
      }
    });
  } finally {
    await client.end();
  }
}

export async function grantAdmin(databaseUrl: string, email: string) {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    const updated = await drizzle(client)
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.email, emailSchema.parse(email.trim().toLowerCase())))
      .returning({ id: users.id });
    if (!updated.length) throw new Error("No account uses that email");
  } finally {
    await client.end();
  }
}
