import "dotenv/config";
import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import { grantAdmin, provisionAccount } from "../src/provisioning";

const emailSchema = z.email().max(254);
const nameSchema = z.string().trim().min(2).max(120);
const passwordSchema = z.string().min(12).max(128);

async function readPassword(label: string): Promise<string> {
  stdout.write(label);
  emitKeypressEvents(stdin);
  const originalRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.off("keypress", onKey);
      stdin.setRawMode(Boolean(originalRaw));
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onKey = (
      character: string,
      key: { name?: string; ctrl?: boolean },
    ) => {
      if (key.ctrl && key.name === "c") return finish(new Error("Cancelled"));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
        return;
      }
      if (character && !key.ctrl && character >= " ") value += character;
    };
    stdin.on("keypress", onKey);
  });
}

async function main() {
  const action = process.argv[2];
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error("Run this command in an interactive terminal");
  if (
    process.argv.length !== 3 ||
    !["provision", "reset", "admin"].includes(action)
  )
    throw new Error("Use account:provision, account:reset or account:admin");
  const connection = process.env.DATABASE_URL;
  if (!connection)
    throw new Error("DATABASE_URL is missing from apps/api/.env");
  const databaseUrl = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol))
    throw new Error("DATABASE_URL must be PostgreSQL");

  const prompt = createInterface({ input: stdin, output: stdout });
  stdout.write(
    `Database: ${databaseUrl.hostname}/${databaseUrl.pathname.slice(1)}\n`,
  );
  const confirmation = await prompt.question(
    `Type ${action.toUpperCase()} to confirm this database: `,
  );
  if (confirmation !== action.toUpperCase()) {
    prompt.close();
    throw new Error("Cancelled");
  }
  const email = emailSchema.parse(
    (await prompt.question("Account email: ")).trim().toLowerCase(),
  );
  if (action === "admin") {
    prompt.close();
    await grantAdmin(connection, email);
    stdout.write("Admin access granted. Sign in and open /admin.\n");
    return;
  }
  const fullName =
    action === "provision"
      ? nameSchema.parse(await prompt.question("Full name: "))
      : undefined;
  if (action === "provision") {
    const consent = await prompt.question(
      "Confirm you are at least 18 and accept the site Terms (yes/no): ",
    );
    if (consent.trim().toLowerCase() !== "yes") {
      prompt.close();
      throw new Error("Age and Terms confirmation is required");
    }
  }
  prompt.close();

  const password = passwordSchema.parse(
    await readPassword("Password (hidden): "),
  );
  const repeat = await readPassword("Confirm password (hidden): ");
  if (password !== repeat) throw new Error("Passwords do not match");
  await provisionAccount({
    databaseUrl: connection,
    action: action as "provision" | "reset",
    email,
    fullName,
    password,
    ageAndTermsConfirmed: action === "provision",
  });
  stdout.write(
    action === "provision"
      ? "Account provisioned. Sign in with your email and password.\n"
      : "Password changed. All sessions revoked.\n",
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Account setup failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
