# Investor evidence — Regalvest 2.0

## Current source build

The local source contains a responsive public site, real PostgreSQL-backed account identity, same-origin API proxy, protected dashboard navigation and isolated financial simulations. Every financial section is labeled as demo data or planned. The waitlist remains functional. The checked-in migration adds identity and demo tables without changing the waitlist table.

Real email delivery requires a Resend API key and verified sender. Those values are not configured as of this report, so public registration, email verification and email recovery remain blocked by a provider configuration step. The API returns HTTP 503 for signup when the provider is absent. A separate operator path provisions a private account without claiming email verification. The requested private account has been provisioned in production Neon; live sign-in is pending deployment. No real payment, banking, trading, custody or investment integration exists.

## Completed checks

- TypeScript checks passed for both packages.
- Web and API lint passed after correcting two web lint issues.
- The Next.js production build generated the public pages, `/demo`, `/privacy`, and dynamic protected dashboard routes. The API production build passed.
- Drizzle migrations `0001` and `0002` applied successfully to the separate Neon `regalvest_test_codex` database.
- Additive migrations `0001` and `0002` were later applied to production Neon after reviewing the SQL. The existing waitlist was not altered. The private account was provisioned with a generated password stored only in an ignored local file.
- All 8 PostgreSQL integration tests passed for the existing waitlist, health, product catalog and documentation, plus registration, duplicate and invalid input, Argon2id sign-in, verification, expired and reused links, separate user data, concurrent duplicate demo savings submissions, insufficient balance, password reset and session revocation. The new private provisioning test covers consent, duplicate refusal, login without an email provider and operator password reset with session revocation. Email transport was mocked in public signup tests; this does not establish live Resend delivery.
- The interactive `account:provision` command was exercised against the isolated test database with a disposable account. Database confirmation, hidden password prompts and account creation completed; the disposable account was deleted afterward.
- The local site and API ran together against the isolated test database. A browser waitlist submission showed success and a direct database count found one row. The synthetic row was removed after QA.
- A disposable verified account was inserted into the isolated test database for browser QA. Sign-in reached a user-specific dashboard. A savings goal and demo deposit persisted through a hard refresh. A later deposit allocated to the goal updated both total savings and goal progress. Sign-out returned to sign-in, and a direct visit to `/dashboard` redirected to `/sign-in?next=/dashboard`. The account was removed after QA.
- Desktop and mobile landing and dashboard views were inspected in Chrome. Narrow tablet and mobile document widths did not exceed the viewport in the checked views. The browser viewport override was reset after inspection.

## Reference access

The supplied HTML dashboard under `reference/` informed module navigation and composition. The Lovable reference was accessible and informed public site structure. The linked Figma node returned an edit-access error through the Figma tool, so its detailed component layout could not be inspected. The provided color palette takes precedence over the reference styling.

## Deployment status

The previous landing page and waitlist deployment remains live at `https://regalvest-web.onrender.com`, and the previous API is live at `https://regalvest-api.onrender.com`. Those URLs were verified for the **earlier MVP** on October 13. This expanded build has **not** been pushed or deployed, and no new-version live checks have been completed. Deployment and live login checks remain before a complete live account demonstration. Resend is optional for private operator access and required for public email flows.

## Scope still in progress

Core demo savings, transfers, trades, investments, cards and rewards have persisted API actions. Academy, P2P, staking, utility payments, invoice collection, payroll, market feeds and regulated accounts remain previews. There is no live email-provider verification yet. See [DEMO_GUIDE.md](../DEMO_GUIDE.md) for the real/simulated boundary and [README.md](../README.md) for deployment steps.
