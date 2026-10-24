# TurboXGlobal investor preview architecture

## Boundaries

`apps/web` is a Next.js App Router site: the public marketing pages and the protected dashboard. `apps/api` is a NestJS REST API backed by PostgreSQL through Drizzle. A Next rewrite proxies `/api/v1/*` and `/api/docs` from the web origin to the API, so the session cookie stays on the website origin.

The API owns identity and every demo value. The browser never supplies a user ID for authorization. A session guard resolves the hashed opaque session token and attaches its owner to the request. The dashboard server layout calls `/auth/me` before rendering, and the API guard independently checks every private endpoint.

Internal package names (`@regalvest/*`), Render service names and the cookie name (`regalvest_session`) predate the TurboXGlobal rebrand. They were kept so existing deployments and sessions continue to work.

## Real identity

Passwords use Argon2id. Verification, reset and session tokens are random 256-bit values, and only SHA-256 digests are stored. Verification and reset tokens expire and work only once. A password reset or change revokes all sessions. The session cookie is HttpOnly, SameSite=Lax, Secure in production, and lasts seven days. State-changing authenticated requests check the Origin header against configured frontend origins.

## Simulated money (`apps/api/src/demo`)

- **`market.ts`**: fixed illustrative prices and FX, fee and limit constants, and decimal parsing.
  - Every quantity is an integer number of 1e-8 units of its asset, held in `bigint` columns. Amounts are parsed from strings, so no floating-point rounding enters the stored value.
- **`core.ts`**:
  - Lazily creates each user's profile and KYC case.
  - Serialises balance changes per user by locking the `account_profiles` row `FOR UPDATE`.
  - Writes ledger rows.
  - Settles pending items lazily when a user reads their data. No background worker is needed.
  - Enforces product gating.
- **`money.ts`**: trades, limit orders, payments, conversion, deposits, withdrawals, cards and investments.
- **`records.ts`**: overview, transactions, CSV export, statements, verification, profile, acquiring and reset.

Every balance-changing action follows the same pattern, inside one PostgreSQL transaction:

1. Lock the user.
2. Look up the idempotency key.
3. Check the balance and limits.
4. Adjust the holdings.
5. Insert one `demo_ledger` row recording the debit, credit and fee.

A unique `(user_id, idempotency_key)` index backs duplicate protection. Repeating a key returns the original row with `duplicate: true`. Payments over the single-transfer limit are recorded as `failed` with a reason and move nothing.

Statements and CSV exports are computed from the ledger. Opening and closing balances come from replaying the ledger up to the period.

## Simulated verification

`verification_cases` holds one KYC case per user and, after switching to a business account, one KYB case.

- **Saving and submitting:** each step is validated with Zod and stored as JSON. Submitting checks that every step is present.
- **Document numbers:** stored masked.
- **Files:** described by name, type and size only. Their contents never reach the server.
- **Reviewer control:** `POST /demo/verification/:kind/review` decides the signed-in user's own case. It exists because `DEMO_MODE=true` is mandatory, and it is labelled in the UI as an investor demo control.

The first KYC approval credits the opening demo balances.

## Product gating

| Product                                    | Unlocked when                                                     |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Trading, payments, accounts, cards, wealth | KYC is verified                                                   |
| Fiat Acquiring                             | KYC is verified, the account type is business and KYB is verified |

The server enforces this (HTTP 403 with a user-facing message). The UI mirrors it.

## Limitations

- Prices, the order book, acquiring volumes, settlements, webhooks and referral history are illustrative or sample data. They are labelled in the UI.
- Limit orders that do not cross the fixed price stay open and never fill.
- MFA is a simulated toggle; sign-in does not ask for a code.
- The waitlist, contact and authentication rate limiters are process-local. Scale to multiple API instances only with a shared limiter.
- Tables from the previous Regalvest demo (savings goals, the old balances and transactions) remain in the database, because the migrations are additive only. They are unused.
