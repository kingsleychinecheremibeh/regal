# Regalvest investor demo guide

## Real functions

The site stores account name, email, Argon2id password hash, consent to terms, preferences, verification state and revocable sessions in PostgreSQL. Email verification and password recovery send real mail only when Resend credentials and a verified sender are configured. The waitlist stores an email and consent timestamp.

## Simulated functions

Every dashboard balance, market figure, card, transaction, order, savings goal and VestPoints balance is demo data. Users can move simulated cash into savings, allocate it to a goal, withdraw it, make simulated trades or investments, preview a transfer, create demo cards, freeze them and check in for points. These actions persist per user, but move no real money or assets. A new account starts with $100,000.00 in fictitious USD cash.

## Suggested tour

1. Register and use the verification link sent to the mailbox. If mail is not configured, registration is unavailable by design.
2. Sign in and open `/dashboard`. Reload the page to see the session and data persist.
3. In SmartSave create a goal, select it, then move demo cash. Goal progress and total savings update together.
4. In TradeHub confirm a small demo trade; see cash, investments and transaction history change.
5. In Virtual Cards create a fictitious card and freeze it. No payment credentials are created.
6. Check in once under VestPoints. Repeating the action on the same UTC day does not award points again.
7. In Settings inspect sessions or reset only the simulated financial data.

The market board is a fixed example, not a live quote feed. P2P, gift cards, staking, utility payments, real estate, agriculture, regulated accounts, merchant tools, payroll, learning progress and redemption are planned presentations. Never treat a demo output as an operational offer or financial advice.
