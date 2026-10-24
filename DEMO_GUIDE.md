# TurboXGlobal investor demo guide

## What is real and what is simulated

**Real:** account sign-up and sign-in, Argon2id password hashes, sessions, email verification and recovery (when Resend is configured), the waitlist and contact forms, and per-user persistence of everything below.

**Simulated:** every balance, price, trade, payment, account number, card, investment, statement and verification decision. No payment, banking, exchange, card-issuing, custody or identity-verification provider is connected. Prices are fixed illustrative values. Card and account numbers are deliberately invalid. Verification uploads never leave the browser; only the file name, type and size are recorded, and identity document numbers are stored masked.

A banner on every page says so.

## Before a session

Sign in and open **Settings → Demo data**:

- **Start over as a new user** resets balances, verification and account type, so you can show onboarding from the beginning.
- **Reset balances and activity** keeps verification and restores the opening demo funds.

## Suggested tour (about 10 minutes)

1. **Public site.** Home page, a product page from the Products menu, and the Business page.
2. **New user.** Sign in. The Overview shows zero balances, locked products and a pending action to verify. Click Buy: a modal explains why it is locked.
3. **KYC.** Settings → Verification. Complete the three steps using _Use sample file_ and _Use sample selfie_, then submit. The status changes to In Review.
4. **Reviewer decision.** In the **Demo reviewer** panel, which is clearly labelled as a demo control, you can:
   - Request more info with a note, to show the Action Required state and the note to the customer.
   - Resubmit, then Approve. Approval credits the opening demo balances and activates the USD and EUR accounts.
5. **Overview.** Portfolio total, allocation donut, limits and recent activity.
6. **TradeHUB.** Buy 0.05 BTC: the review shows price, the 0.5% fee and the total, and history updates. Then swap SOL to ETH, and place a limit order below the price to see it stay open.
7. **TurboXPay.** Add a beneficiary in EUR and send 100 USD. The review shows the fee, rate and recipient amount. Then:
   - Press **Send payment** again without editing the form, to show the duplicate request being blocked by the idempotency key.
   - Send 6,000 USD, to show a declined payment recorded with its reason.
8. **Global Accounts.** Reveal account details, convert USD to GBP, and request a GBP account. It moves from Provisioning to Active after about a minute.
9. **Virtual Cards.** Create a card, simulate a purchase, freeze the card and simulate again to show it declined. Reveal details with any 6 digits; they hide after 30 seconds.
10. **Wealth.** Read a disclosure. Invest in the Global equity ETF; this requires the risk acknowledgement.
11. **Transactions and Statements.** Filter, open a receipt, export CSV, and open the monthly statement (printable to PDF).
12. **Business.** Settings → Verification → Switch to business. Complete KYB (company, directors and owners, documents, profile), submit and approve. Fiat Acquiring appears in the sidebar. Create a payment link and an API key; the key is shown once.

Pending items, such as deposits, payments and trades, complete after a few seconds. The dashboard refreshes on its own.

## Things to say plainly

The preview demonstrates product flows and the engineering foundations: per-user data isolation, idempotent money movement, row-level locking and an auditable ledger. It is not a licensed financial service, and its prices are not quotes. Launching for real requires regulated partners for each product.
