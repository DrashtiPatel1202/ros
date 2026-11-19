# REA Counter MVP

A manager stands with the guest, asks what they want, and taps it into the counter. The screen saves the ticket. It does not take payment.

## Run

From the repo root, with PostgreSQL and Redis already running on localhost:

```bash
npm install
npm run db:setup
npm run dev
```

Open http://127.0.0.1:5173 and sign in with PIN **1234**.

`npm test` checks the bill maths and one full save → edit → cancel against the database.

## What you can do

- Sign in, browse the menu by category, or search by dish name or short code.
- Build a dine-in, pickup, or delivery ticket with quantities and notes.
- Save it. A flat 5% GST is added. The order number resets each business day.
- Review today's orders, open one, change it, or cancel it.

What is finished, partial, or missing is listed in [FEATURE-STATUS.md](./FEATURE-STATUS.md).
