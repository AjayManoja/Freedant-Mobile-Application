# Payment service

Owns **money**. Isolated so no bug elsewhere can touch balances or payment state.

- **Data:** payment orders, raw webhook events, ledger accounts / transactions / entries (double-entry, append-only), refunds
- **Responsibilities:** create Razorpay orders (server-set amount), verify signed webhooks idempotently, record ledger entries, automatic refunds, winner credits, wallet balance
- **Publishes:** `payment.captured`, `payment.failed`, `refund.completed`
- **Consumes:** `registration.rejected`, `results.published`
- **Built in:** Sprints 3–4 and 6
