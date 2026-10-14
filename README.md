# Regalvest 2.0 investor application

Next.js public site and protected dashboard, NestJS REST API, and PostgreSQL persistence. Account identity is real. Every financial value and action is an isolated simulation. See [DEMO_GUIDE.md](DEMO_GUIDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Requirements

Node.js 20.9+, pnpm 10 and PostgreSQL 17+. On Windows PowerShell use `pnpm.cmd` when script execution policy blocks `pnpm.ps1`. Docker Compose is optional; `compose.yaml` starts a local PostgreSQL instance on port 5433.

## Local setup

```powershell
pnpm.cmd install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
# If Docker is installed: docker compose up -d postgres
pnpm.cmd db:migrate
pnpm.cmd dev
```

Edit `apps/api/.env` before migrating. Set `DATABASE_URL` to a PostgreSQL connection string for the intended development database. The example Docker URL is for local use only. Set `CORS_ORIGINS` and `PUBLIC_WEB_URL` to the web origin. Set `API_PROXY_TARGET` in `apps/web/.env.local` to the API origin, normally `http://localhost:4000`. Keep `DEMO_MODE=true`.

For real signup, email verification and recovery, add a Resend API key and an address on a verified sending domain to the ignored API environment file:

```text
RESEND_API_KEY=<private key>
EMAIL_FROM=verified-sender@example.com
```

Without those values, registration returns HTTP 503 before creating an account. Existing accounts can still sign in. Never commit credentials or paste them into chat. The API runs on `http://localhost:4000`, the site on `http://localhost:3000`, and Swagger on `http://localhost:4000/api/docs`.

### Private account without an email provider

For a single operator-controlled account, apply the migrations and run this in an **interactive terminal** from the repository root:

```powershell
pnpm.cmd --filter @regalvest/api account:provision
```

The command displays the database host and name for confirmation, then asks for your email, name, age and Terms confirmation, and a password twice. Password input is hidden, is never passed as a command argument or written to an environment file, and is stored only as an Argon2id hash. It refuses an existing email. Sign in at `/sign-in` with the account you created. This path records operator provisioning separately from email verification; it does not claim that the mailbox was verified. Public signup and email recovery still require Resend.

If you lose the password, an operator with access to the same database can run `pnpm.cmd --filter @regalvest/api account:reset` in an interactive terminal. That command replaces the password hash and revokes all current sessions. Keep database credentials and terminal access private. For the live site, run these commands against the production database only after reviewing and applying the migrations there; the local `.env` determines which database is targeted.

## Validation

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
```

For PostgreSQL integration tests, set `TEST_DATABASE_URL` to a **separate database whose name contains `test`**. The suite refuses to run database tests against any other name. It migrates that database, inserts temporary accounts and removes them. A green run with the integration suite skipped is not database verification.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://user:password@localhost:5433/regalvest_test'
pnpm.cmd test
```

Schema changes use `pnpm.cmd db:generate` followed by review of the SQL migration, then `pnpm.cmd db:migrate`. Do not use `drizzle-kit push` on a deployed database. The existing migration history is additive and preserves the waitlist.

## Deployment

The older landing page and waitlist are live at [regalvest-web.onrender.com](https://regalvest-web.onrender.com); the older API is live at [regalvest-api.onrender.com](https://regalvest-api.onrender.com). **The expanded account and dashboard build is currently local and has not been deployed or live-verified.** Do not present the live URLs as the new full-stack version until deployment checks pass.

The intended low-cost setup is Neon PostgreSQL plus Render API and web services. Vercel may host the Next.js frontend on a plan whose terms permit this investor-facing use. Use the same-origin `/api/v1` rewrite for auth cookies.

1. For private operator access, provision an account with the command above. Add `PUBLIC_WEB_URL=https://<web-origin>` and `DEMO_MODE=true` to the Render API environment. Keep `DATABASE_URL` private. Set `CORS_ORIGINS` to the exact HTTPS web origin and `TRUST_PROXY_HOPS=1`. Resend keys and a verified sender are needed only to enable public signup and email recovery.
2. Review and apply checked-in Drizzle migrations to the intended production Neon database using `pnpm.cmd db:migrate` with its private `DATABASE_URL`. The new migration adds identity and demo tables; it does not alter the waitlist.
3. Render API service: leave Root Directory blank. Build: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @regalvest/api build`. Start: `corepack pnpm --filter @regalvest/api start`.
4. Render web service: leave Root Directory blank. Build: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @regalvest/web build`. Start: `corepack pnpm --filter @regalvest/web start`. Set `API_PROXY_TARGET=https://<api-origin>` and `NEXT_PUBLIC_API_URL` to the same origin for server rendering compatibility. Rebuild when the API origin changes.
5. Verify live health, Swagger, public pages, operator-provisioned login cookie, hard-refresh dashboard, demo persistence, logout and mobile layouts before sharing the new version. If Resend is configured later, also verify signup email delivery, one-use verification and password recovery.

Render Free services may sleep while idle. The API rate limiter is process-local and should be replaced before horizontal scaling. The source and deployment status are recorded in [docs/investor-evidence.md](docs/investor-evidence.md).
