# Regalvest 2.0 architecture

## Boundaries

`apps/web` is a Next.js App Router site. `apps/api` is a NestJS REST API backed by PostgreSQL through Drizzle. `/api/v1/*` is proxied from the web origin to the API by a Next rewrite. The session cookie therefore stays on the website origin in a browser. The API also permits explicitly configured origins for direct public requests.

The API owns identity and every demo balance. The browser never supplies a user ID for authorization. A session guard resolves the hashed opaque session token and attaches its owner to protected requests. The dashboard server layout calls `/auth/me` before rendering, and the API guard independently checks every private endpoint.

## Real identity

Passwords use Argon2id. Verification, reset and session tokens are random 256-bit values; only SHA-256 token digests are stored. Verification and reset tokens expire and can be consumed once. A password reset revokes all sessions. The session cookie is HttpOnly, SameSite=Lax, Secure in production, and expires after seven days. State-changing authenticated requests check the Origin header against configured frontend origins. No token is stored in browser localStorage.

Resend delivers verification and reset links when `RESEND_API_KEY` and `EMAIL_FROM` are configured. The token is in the URL fragment so the browser does not send it in an HTTP request to the page. The page submits it to the API in a POST body. Signup returns a service-unavailable response if email delivery is not configured; it does not create an unverifiable account in that case. A provider outage after account creation can leave an unverified account; the resend endpoint can recover it.

## Financial simulation

The only values with financial meaning in this app are isolated demo values. `DEMO_MODE=true` is required by configuration. There are no payment, banking, brokerage, exchange or custody provider integrations. The service stores money as integer minor units. A balance-changing action locks the user's balance row, checks its idempotency key, updates balances and inserts a transaction in one PostgreSQL transaction. Savings allocations update their goal in the same transaction. A unique `(user_id, idempotency_key)` index backs duplicate protection.

Read routes and writes are scoped to the authenticated user. New accounts receive a fresh demo balance and preferences in the registration transaction. Demo data can be reset without touching identity data.

## Limitations

- The waitlist and authentication rate limiters are process-local. Scale to multiple API instances only with a shared limiter.
- Server sessions are opaque and revocable, but there is no multi-factor authentication or device fingerprinting.
- The current market board uses fixed illustrative prices. Investment performance is not calculated.
- The dashboard modules present the product vision at different depths; Academy, P2P, staking, merchant collection and payroll are informational previews.
