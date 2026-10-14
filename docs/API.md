# API notes

Swagger UI is served at `/api/docs`. All routes use `/api/v1`.

## Public

`GET /health`, `GET /products`, `POST /waitlist`, `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`.

Registration requires `{fullName,email,password,confirmPassword,ageConfirmed:true,termsAccepted:true}`. Passwords must have at least 12 characters. Login requires `{email,password}`. Verification requires `{token}`. Password reset requires `{token,password}`. Repeated waitlist submissions return the same generic success response. Forgot-password responses do not say whether the email exists.

## Authenticated

`/auth/me`, `/auth/sessions`, `/auth/sessions/:id`, `/auth/logout`, `/auth/logout-all`, `/users/me`, `/users/me/password`, `/users/me/preferences`, and all `/demo/*` routes require the HttpOnly session cookie. Browser calls use the same-origin `/api/v1` proxy. State-changing requests require an allowed Origin.

Demo balance changes use `POST /demo/transfers`, `/demo/trades`, `/demo/investments/orders`, `/demo/savings/deposit` or `/demo/savings/withdraw`. Supply an `Idempotency-Key` header of 8–100 characters and a JSON body with a positive integer `amountMinor` and a `description`. Savings actions can include `goalId`. Trading and investment actions can include an example `symbol`. A duplicate key for the same user returns the original transaction without applying another balance change.

Amounts are integer USD cents for this demo. No route accepts a real destination account or wallet. See [ARCHITECTURE.md](../ARCHITECTURE.md) for the trust boundaries.
