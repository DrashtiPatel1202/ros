# MVP feature status

**Product:** REA Counter — manager takes a guest's order by asking and entering it.
**Last updated:** 2026-11-19
**Superseded for product goal:** A full Petpooja Billing clone (same features + same UI) is tracked in [`../petpooja-clone/`](../petpooja-clone/). Do **not** treat this counter as the clone. Keep this file only if you still care about the thin MVP experiment.

**Extent key:** **Full** means the MVP behaviour below is done. **Partial** means it works, with the gaps named. **Not started** means it is not in this build.

This is not the full Petpooja back-office. That catalogue stays in [../petpooja-billing/FEATURES-EXPLAINED.md](../petpooja-billing/FEATURES-EXPLAINED.md). The rows below are only what this MVP set out to cover, plus the scale and safety work that supports it.

## Ordering

| Feature | Extent | What works | What is missing |
| --- | --- | --- | --- |
| Manager signs in | Partial | 4-digit PIN, lockout after 8 failures in 15 minutes, 12-hour HttpOnly session | One shared PIN for the outlet. No staff list, roles, 2FA, or per-person audit of who saved the order |
| Browse the menu | Partial | Categories, dish name, short code, price, veg / non-veg / egg. Only available dishes | No photos, descriptions, variants, add-ons, combos, or area-wise prices. A category is capped at 200 dishes |
| Search the menu | Full for this MVP | Name contains the text, or short code starts with it. At most 20 hits | No fuzzy spelling correction |
| Take an order | Full for this MVP | Dine in, pickup, or delivery. Optional table and guest name. Quantity 1–99. Per-dish note and an order note. Duplicate dishes with the same note are merged | No table map, no course or seat, no modifier screen. Table is not required |
| Price and tax | Partial | Prices stored in paise. One outlet GST rate (seeded at 5%), rounded half-up to the paisa. Preview and save use the same formula | Not the full tax engine: no CGST/SGST split, inclusive tax, tax-on-tax, or per-item tax. Saving an edited order reprices every line from the current menu, so a mid-order price change would move the total |
| Save the ticket | Full for this MVP | One database transaction, daily order number, idempotency key so a double tap does not create two orders | No print, KOT, or kitchen screen. "Save" is the whole action |
| Change an open order | Full for this MVP | Replace lines, notes, type, table, and guest. Optimistic lock (`version`) so two screens cannot overwrite each other silently | Cannot change a cancelled order. No line-level void reason |
| Cancel an order | Partial | Open order becomes `cancelled` and stays on today's list. Confirm step. Same version lock | No cancel reason, no OTP, no restore |
| Today's order list | Partial | Open / cancelled / all, newest first, 30 per page, keyset "earlier" pages | Today only, in the outlet timezone. No date range, text search, export, or live push (the list refreshes when you open it or return to the tab) |
| Order detail | Full for this MVP | Lines, notes, subtotal, tax, total, status, time | No bill print, payment split, or edit history |
| Payment | Not started | — | No cash, card, UPI, split bill, or due |
| Kitchen ticket | Not started | — | No KOT, printer, or KDS |

## Scale, safety, and payload size

| Feature | Extent | What works | What is missing |
| --- | --- | --- | --- |
| Database shape | Partial | Bigint keys, paise as integers, order number unique per outlet per day, indexes for "this outlet, today, newest first", trigram index for dish search, `outlet_id` repeated on order lines so a future monthly partition can prune | Not partitioned yet. No read replica. Partitioning is the next step once orders are large, not before |
| Lean order list | Full for this MVP | List rows omit lines and notes. Detail is a separate call | — |
| Lean menu calls | Full for this MVP | Categories, one category of dishes, and search are separate. Responses are id, name, code, price, dietary | — |
| Caching | Partial | Menu responses cached in Redis (5 minutes, keyed by menu version) and `ETag` / `Cache-Control: private, max-age=60`. Search cached 30 seconds. Browser query cache 60 seconds. Orders are `no-store`. Redis failure falls through to Postgres for the menu | Nothing bumps `menu_version`, because there is no menu editor yet. No CDN. Sessions live only in Redis |
| Idempotency | Full for this MVP | `Idempotency-Key` on create. Same key and same order returns the original ticket. Same key and a different order is rejected. Keys older than a day are deleted when the API starts | No scheduled cleaner while the API stays up for many days |
| Validation and errors | Full for this MVP | Request size cap 32KB, qty and note limits, unavailable dish rejected, version conflicts, PIN rate limit, 5s statement timeout, pool of 10 | No request tracing across services |
| Offline POS | Not started | The counter needs the API | No local database or sync queue |

## Explicitly out of this MVP

Not started, and not stubbed: inventory, recipes, discounts beyond a flat GST, reports, aggregator inboxes, wallet, loyalty, CRM, marketplace, device pairing, multi-outlet switching, and the back-office settings screens. Build those from [../petpooja-billing/dev/subagent-task-briefs.md](../petpooja-billing/dev/subagent-task-briefs.md) when this counter is accepted.
