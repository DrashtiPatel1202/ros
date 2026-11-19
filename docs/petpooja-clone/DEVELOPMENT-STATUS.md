# Clone development status

**Last updated:** 2026-11-19  
**App:** `apps/billing` (Petpooja-like UI) + `apps/api` billing routes  
**Run:** `npm run dev:clone` → http://127.0.0.1:5174  
**Login:** `demo@harbour.kitchen` / `demo1234`

## Waves

| Wave | Status | Notes |
| --- | --- | --- |
| Wave 0 — Shell + auth | **Partial / in progress** | Sign-in (email → password), session cookie, logout, full sidebar tree, header (outlet switcher, Explore Products mega-menu, notifications chrome, profile menu), AI Agent drawer + FAB, device mapping modal, Quick Links foot, Edit Profile (2FA toggle + change password). All other nav leaves are **Shell only** placeholders. |
| Wave 1 — Dashboard | **Partial / in progress** | Sales statistics + Highcharts (Column/Area/Line), tender breakdown, channel cards, online orders table, Action Center drawer, Daily Snapshot banner, FSSAI fix modal, upsell cards (Risk, Attendo, Expense, Retention, margin, Quick Help). Data is zeroed like the demo outlet; not yet wired to live order aggregates. |
| Wave 2 — POS ordering | **Working** | Full-screen POS at `/pos/billing` (table floor, KOT, running orders, move table, Save / Save & Print / Settle). The back-office KOT list filters by date, type, status, table, customer and modified tickets. A second guest on a busy table is seated as 1A, 1B, 1C. Online orders, day end, and delivery management are still placeholders. |
| Wave 3 — Outlet configuration | **Working** | Hub at `/users/res_new/1`, the 15 setting pages, sub order types, delivery distance, area charges, and the visual floor plan (drag, shapes, size, barriers). Display settings drive POS labels, payment buttons, and the default screen. |
| Wave 4 — Menu | **Partial** | Menu home, item/category editor, on/off, taxes and percentage/fixed discounts. The default tax and active offers drive the POS bill. Variants, addons, images and virtual brands are still to build. |
| Wave 9 — Inventory | **Partial** | Dashboard, raw materials, suppliers, recipes, purchase, purchase order, wastage, closing stock, current stock. Purchases update a stock ledger. Settled bills deduct recipe quantities when auto consumption is on. Production, transfers and the longer reports are still to build. |
| Wave 5 — Users, devices, logs | **Working** | Biller users, device mapping (sync code + pair), apps list, the user-log pages, support notes, notifications, and the 180-day audit trail. Online-store, auto-accept, and menu-trigger logs stay empty until those aggregators write events. |
| Wave 6 — Accounting | **Working** | Digital payout list from settled card/UPI bills, virtual wallet, reconciliation disputes, GST profile, bank accounts, expense/withdrawal/top-up, service invoices, loans, and cash denominations. Live aggregator payout files are not connected. |
| Waves 7–8, 10–12 | Not started | See [03-CLONE-BACKLOG.md](./03-CLONE-BACKLOG.md) |

## Still missing vs Petpooja (Wave 0/1)

- Exact CSS pixel match (spacing, icons, logo asset)  
- Need Help call-back panel  
- Real notification feed  
- 2FA challenge at login (toggle exists; login OTP not enforced yet)  
- Dashboard widgets with real sales / inventory / staff series  
- Onboarding progress widget polish  

## Do not use

`apps/web` REA Counter MVP — separate experiment. Clone UI is only `apps/billing`.
