# Investor evidence — Regalvest 2.0 MVP

## Implemented

- Responsive landing page with five clearly planned product categories, intended future workflow, roadmap, pre-launch notices, privacy notice, and waitlist.
- NestJS API with health, planned products, and waitlist endpoints; Swagger UI at `/api/docs`.
- PostgreSQL waitlist persistence through Drizzle ORM and a checked-in migration. Email is normalized, consent is required, and duplicate submissions do not create duplicate records.
- Input validation, unique database constraint, Helmet, configurable CORS, per-IP waitlist rate limiting, structured Nest logs, and centralized API errors.
- `/demo` dashboard with sample balances, allocation, and activity explicitly marked **DEMO DATA**. It has no authentication or transaction controls.

## What is functional

The waitlist stores real email submissions with consent timestamps. Health checks the database. The products endpoint returns structured planned-category data. Local development and API docs are available with the commands in the [README](../README.md).

## What is illustrative or planned

The dashboard's values and activity are fictional. Banking, investments, crypto, business financial tools, rewards, profile creation, wallets, payments, KYC, and transfers are planned capabilities only. No financial account is created by joining the waitlist.

## Verification performed

- TypeScript checks: passed for API and web.
- Lint: passed; two initial warnings were corrected before final verification.
- Production build: passed for API and web, including `/demo` and `/privacy`.
- PostgreSQL integration tests: passed against an isolated local `regalvest_test` database for health, five planned products, Swagger generation, validation, normalized persistence, duplicate handling, and rate limiting. Two additional configuration and catalog tests pass without a database.
- Live local requests: health, products, `/api/docs`, and landing page returned HTTP 200.
- The documented `pnpm.cmd dev` command started both apps from the workspace; the API, landing page, demo page, and Swagger UI were checked again after startup.
- Browser form: synthetic test submission displayed success, and a PostgreSQL query found one matching row with a consent timestamp.
- Browser layout checks: desktop, tablet, and mobile views inspected in Chrome; mobile and tablet document widths did not exceed the viewport. The landing page, demo, and Swagger views were captured in the browser during review; no screenshot files were exported into this repository.
- Production deployment: not performed; no deployment credentials or Git remote were available in the task environment. No public URLs have been verified.

## How to verify

Use the [README setup and test commands](../README.md). Query `GET /api/v1/health` and `GET /api/v1/products`; open `/api/docs`; submit `POST /api/v1/waitlist` with `{"email":"test@example.com","consent":true}` against a disposable local database. Repeat the request and verify a single normalized database row. Do not submit real investor emails during a demonstration without their consent.

## Next milestones

1. Validate the product and compliance roadmap with financial and legal partners before promoting any feature as available.
2. Add an operational email delivery service and unsubscribe workflow before sending waitlist updates.
3. Design authenticated profiles and regulated integrations only after requirements, providers, and security controls are defined.
