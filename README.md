# Regalvest 2.0 investor MVP

A pre-launch proof of concept: a responsive Next.js landing page, a NestJS REST API, and a PostgreSQL waitlist. The financial products and `/demo` dashboard are **concepts**, not available services. The waitlist is the only user-facing persisted feature.

## Requirements

- Node.js 20.9 or later, pnpm 10, and PostgreSQL 17 or later. Docker is optional for local PostgreSQL.
- On Windows PowerShell, use `pnpm.cmd` if script execution policy blocks `pnpm.ps1`.

## Local setup

```powershell
pnpm.cmd install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
```

If Docker is unavailable, use an existing local PostgreSQL server and update `DATABASE_URL` in `apps/api/.env`. Create a dedicated `regalvest` database and user first. The example Docker database listens on port `5433` to avoid conflict with another local server. Do not use the example password in production.

Apply the checked-in migration, then start both apps:

```powershell
$env:DATABASE_URL = 'postgresql://regalvest:local_only_change_me@localhost:5433/regalvest'
pnpm.cmd db:migrate
pnpm.cmd dev
```

The API and Drizzle Kit load `apps/api/.env`; Next.js loads `apps/web/.env.local`. Visit `http://localhost:3000`, `http://localhost:3000/demo`, and `http://localhost:4000/api/docs`.

You may override these values for one PowerShell session:

```powershell
$env:DATABASE_URL = 'postgresql://regalvest:local_only_change_me@localhost:5433/regalvest'
$env:CORS_ORIGINS = 'http://localhost:3000'
$env:PORT = '4000'
pnpm.cmd dev
```

## Checks

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
```

For database integration tests, use a **separate database whose name contains `test`**. The test creates its own migration table, inserts a temporary email, and removes it. It refuses to run the integration suite unless `TEST_DATABASE_URL` names a test database.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://regalvest:local_only_change_me@localhost:5433/regalvest_test'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:CORS_ORIGINS = 'http://localhost:3000'
pnpm.cmd test
```

Without `TEST_DATABASE_URL`, Vitest skips the PostgreSQL integration suite; a green skipped run is not database verification.

## API

| Route                   | Purpose                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/v1/health`    | API and database readiness, service name, timestamp                                           |
| `GET /api/v1/products`  | Five product categories, all marked `planned`                                                 |
| `POST /api/v1/waitlist` | Validates email and consent, stores normalized email, returns the same success for duplicates |
| `GET /api/docs`         | Swagger UI                                                                                    |

Waitlist request example:

```json
{ "email": "investor@example.com", "consent": true }
```

## Deployment

This workspace began without a Git repository. Initialize Git and push to a remote before using Git-connected Vercel or Render deployment.

```powershell
git init
git add .
git commit -m "Build Regalvest investor MVP"
git branch -M main
git remote add origin <YOUR_REPOSITORY_URL>
git push -u origin main
```

1. Create a managed PostgreSQL database on Render or another trusted provider. Keep its connection URL server-side. Set `DATABASE_URL`, `CORS_ORIGINS=https://YOUR_WEB_DOMAIN`, `NODE_ENV=production`, `PORT`, and `TRUST_PROXY_HOPS=1` for Render's trusted proxy on the API service. Use workspace root as the service root; build with `pnpm install --frozen-lockfile && pnpm --filter @regalvest/api build`, start with `pnpm --filter @regalvest/api start`.
2. Run `pnpm --filter @regalvest/api db:migrate` against the production database as a controlled release step before directing traffic to the API. Never use `drizzle-kit push` against production.
3. Deploy `apps/web` to Vercel from this monorepo, with `apps/web` as the root directory. Set `NEXT_PUBLIC_API_URL` to the public HTTPS API origin, without a trailing slash. Next.js embeds this variable at build time, so rebuild after changing it.
4. Confirm API health, products, Swagger, CORS from the web origin, waitlist submission and duplicate behavior, and the Vercel page on a narrow mobile viewport. No production deployment is claimed by this repository.

The public waitlist limiter is process-local and suited to a single API instance for this MVP. Use a shared limiter if the API is later scaled across instances.
