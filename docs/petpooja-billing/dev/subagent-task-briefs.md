# Sub-agent task briefs

Copy one brief per sub-agent. Each brief is self-contained: it lists what to read, what to build, the acceptance criteria and the boundaries. Replace `{STACK}` with your chosen stack (e.g. "TypeScript, NestJS, PostgreSQL, React") and `{REPO}` with the target repository path.

**Shared preamble (prepend to every brief):**

> You are building part of REA-POS, a restaurant POS + back-office whose feature set is documented in `docs/petpooja-billing/`. The docs describe an existing product (Petpooja) observed from its UI. Treat them as **functional requirements, not as an implementation to copy**: design your own schema, API and UI, keep Petpooja's capabilities and operator-facing behaviour, and never copy its branding, text, or assets. Read `docs/petpooja-billing/README.md`, `dev/implementation-roadmap.md` (architecture principles), `reference/data-model.md` and `reference/enums-and-options.md` first. Stack: {STACK}. Repo: {REPO}. Multi-tenant (`org_id`, `outlet_id` on every row); money in integer minor units; every mutation emits an audit event; every list uses the standard list shell (date presets, filters, server paging, export current/all, bulk actions). Write tests for business rules. If a requirement is marked *unknown* or *open question*, make a sensible choice and record it in `DECISIONS.md`.

---

## B0 — Platform foundation

**Read:** `01-authentication.md`, `modules/09-users-devices.md`, `modules/10-logs-audit.md`, `modules/12-marketplace-integrations.md` (Implementation guidance), `dev/implementation-roadmap.md`.

**Build:**
1. Tenancy: Organization, Brand, Outlet (fields from `07` §1 Outlet Details), and the head-office → outlet relationship.
2. Admin auth: email *or* mobile (with country code) + password, optional TOTP/OTP 2FA, change password, logout, session listing. Rate-limit and lock out after repeated failures.
3. Step-up verification service: `requirePassword(actor)` and `requireOtp(actor, purpose, ttl=10m)`, reused by order removal, day-end deletion, wallet reset, sync-code generation and phone unmasking.
4. Staff (POS) users: types `billing_user | delivery_boy | waiter | captain | online_acceptance_app`, username, user code, password, passcode (PIN), swipe code, user groups + permissions, and change history.
5. Device pairing: generate a short-lived sync code (password-confirmed) and accept a mapping code shown on a device; list terminals per outlet with version and last sync.
6. An append-only `audit_event` table + query API with filters by category, entity, actor and date (180-day retention job).
7. An entitlements service plus `requireEntitlement(product_code)` middleware.
8. Quick links (pin up to N routes per admin).

**Acceptance:** an admin with 2FA can log in, create an outlet and a captain user, and pair a device with a code; every step appears in the audit log; protected endpoints reject requests without the entitlement.

---

## B1 — Menu catalogue

**Read:** `modules/04-menu-management.md` (all of it), `reference/enums-and-options.md#menu`.

**Build:**
- CRUD + rank ordering for parent categories, categories (with schedule timings, order-type exposure, online/captain/QR exposure, images, tags, grouping), items (all flags O/V/A/C/F/K/D, dietary, HSN, SAP code, ignore tax/discount), variations, addon groups (min/max) + addon items, and menu areas with per-area price/availability.
- Tables and areas (for dine-in), linked to menu areas.
- Order preferences: item notes, cooking preferences, order notes, allergens.
- Item commission (percentage/fixed) per item and per addon.
- Virtual brands: subset of categories/addons, logo, bill header/footer.
- Bulk operations: inline grid edit, select + quick actions, copy to branch (HO → outlets), CSV/Excel import/export with templates for categories, items, variations, addons and tables.
- Multi-image upload wizard (module → target platform/brand → items → files).
- A menu version + change feed (`recent_menu_changes`) for POS sync and aggregator push.

**Acceptance:** you can import a 500-item menu from CSV, change prices for one area only, and see a menu version bump that POS clients fetch.

---

## B2 — Tax engine

**Read:** `04` §2.6, `07` §9 Calculations, `reference/enums-and-options.md`.

**Build:** a pure, deterministic function `computeBill(lines, outletSettings, taxes, discounts, charges) → breakdown`. It must support:
- GST slabs with the CGST/SGST split, IGST, VAT, custom taxes and cess.
- Forward (exclusive), backward (inclusive) and tax-on-tax.
- Taxes per item × area × order type, the "consider in core amount" setting, and tax on service, container and delivery charges.
- Tax before or after discount, and round-off modes and increments.
- Surcharge by payment mode, tips, and complimentary orders (no tax and no charges).

Ship it as a shared package used by both the POS and the cloud.

**Acceptance:** at least 60 table-driven tests cover each option combination, and outputs match hand-calculated examples to the paisa.

---

## B3 — Discount engine

**Read:** `04` §2.7 (full form), `07` §7 (Discount, Hierarchy Discount OTP, Special Order Discount) and §9 (Discount).

**Build:** discount definitions with the following:
- Types: percentage, fixed, BOGO, DISH, flat rate, BXGY, freebie, fixed price.
- Channel and outlet scoping, order types, and applicability (all/categories/items) on the buy side and the get side.
- Order-total range, max cap, core vs total, and validity dates/times/days.
- Deal type (auto, code, assigned coupon), first-order-only, and terms.

Also build:
- An evaluator integrated with B2: auto-apply, coupon validation, BOGO price ordering, and "ignore add-on price".
- Push to outlets with progress tracking.
- An approval chain (hierarchy discount OTP by % range → approver email/WhatsApp).

**Acceptance:** there is a test matrix per type, and an over-limit manual discount triggers an OTP approval.

---

## B4 — Outlet settings

**Read:** `modules/07-outlet-configuration.md` (all 15 sections + related lists).

**Build:**
- A JSON-Schema-validated, versioned settings document per outlet, with sections mirroring the 15 cards.
- A settings UI with a global search across setting labels.
- Copy configuration to other outlets, and a change log (before/after).
- Invoice sequences (multiple series, reset rules), sub-order types, delivery distance slabs, area/locality delivery charges, and a floor plan designer (drag tables/shapes per floor).
- Payment type configuration: built-in types, custom types, card options and UPI providers.

**Acceptance:** each setting key in `07` maps to a schema property with a default, and POS clients receive the settings via sync.

---

## B5 — POS billing client (offline-first)

**Read:** `modules/03-orders-billing.md`, `07` §7, §9–§14, `modules/09-users-devices.md` (Architecture insight), `dev/implementation-roadmap.md`.

**Build:** a POS app with a local database and a sync queue. It must cover:
- **Ordering:** order types and labels, sub-order types, table management with lock/release rules, pax, the KOT flow (print on save, modified-only KOTs, cancelled KOTs, shift table), and settlement with split/part payments and default payment buttons.
- **Order changes:** cancel, edit, complimentary and sales return, with reason lists, time windows and notifications. Also negative quantity with reasons, NC price change, special notes and advance orders.
- **Cash and day end:** day end and shift end with block rules, cash drawer, expenses/withdrawals/top-ups against master heads, denominations count, and petty cash.
- **Login and printing:** passcode or swipe login, manager password, idle logout, and bill/KOT print templates (all toggles in `07` §11).
- **Sync:** batch size, interval and pending-order sync, idempotent on client IDs.

**Acceptance:** the POS bills and prints KOTs with the network unplugged for a full day; on reconnect it syncs without duplicates; the back-office shows the identical totals.

---

## B6 — Back-office orders & dashboard

**Read:** `02-dashboard.md`, `03` §1, §2, §4, §5, §6.

**Build:**
- **Orders:** Live Orders (running orders/tables, polled or pushed) and All Orders with all 17 filters, Order and Advance Order tabs, a last-15-days chart, export, and a detail drawer. The detail drawer supports edit, change payment, cancel with reason, and OTP-protected permanent removal.
- **Other lists:** KOT list with status filters, Day End Summary (OTP removal), and Delivery Management.
- **Dashboard:** independent KPI widgets with retry, shared date presets, channel cards (orders, min/avg/max, discount, taxes, total, average turnaround), online platform table, item performance, expenses, onboarding progress, and the Action Center (missing descriptions/photos/tax/FSSAI with fix-it modals).

**Acceptance:** every widget's figures reconcile with the All Orders export for the same range.

---

## B7 — Reports platform

**Read:** `modules/06-reports.md`.

**Build:**
- A report registry (`id, category, name, description, filters[], columns[], query, scope, exports`) with a catalogue UI (categories, favourites, search, View Details) and a runner with xlsx/pdf export.
- Scheduled report notifications by email/WhatsApp.
- Implement at least: POS Collection, Item Wise Sales, Category Wise Sales, Payment Wise, Biller Wise, Cancel Orders, Discounted Orders with Reason, Tax Item Wise, HSN, Day Wise Growth, Hourly Item, KOT Process Time, Complimentary, Due Payment, Tip Summary, Online Platforms, and All Restaurant Sales (multi-outlet).

**Acceptance:** adding a new report needs only a registry entry plus a query, and totals match B6.

---

## B8 — Online ordering & integrations hub

**Read:** `03` §3, `04` §4, `07` §13, `10` (Online Store/Item/Auto-accept/Menu Trigger logs), `12`.

**Build:**
- A connector interface (`authorize`, `pushMenu`, `pushItemAvailability`, `pushStoreStatus`, `receiveOrder`, `updateOrderStatus`, `fetchPayouts`) and an order inbox with the lifecycle state machine from `03` §3.
- Order handling: auto-accept with KOT/bill print, an auto-cancel timer, prep and delivery times, rider details and OTP, a cancel flow with reasons, and Generate Invoice for missing orders.
- Availability: store on/off with duration and reason, and item/addon/variation on/off with duration presets, both with batched push ("auto in 5 minutes").
- Per-connector request logs with a downloadable payload, retries, and log pages.
- Online order reconciliation (payout vs POS) with a dispute email.
- Ship one mock connector + one real sandbox.

**Acceptance:** a mock aggregator order goes from webhook → accepted → KOT → dispatched → delivered, with the status pushed back at each step and every call logged.

---

## B9 — Customers, CRM, loyalty, wallet

**Read:** `modules/11-crm-marketing.md`, `08` §2, `07` §10 (Loyalty) and §12 (Customer).

**Build:**
- **Customers:** dedupe by phone per org, source tracking, tags, DND and CRM eligibility. Phones are masked by default and unlocked per session with a password (B0 step-up). Customer-specific discounts.
- **Feedback:** feedback, complaints and ratings; QR/link feedback capture.
- **Segments and campaigns:** rule-based segments with refresh. Campaigns (scheduled, birthday, anniversary, on-bill-print) over SMS/WhatsApp with credit balances. A transactional message catalogue (e-bill, order accepted/dispatched, loyalty and wallet OTPs).
- **Loyalty:** earn/redeem/revert rules, with triggers per order type/channel.
- **Virtual wallet:** issue card, top-up, redeem, refund, return, replace, block, and OTP-protected bulk balance reset with exclusions.
- **Gift cards.**

**Acceptance:** the wallet ledger always sums to the card balance; an unmasked phone number appears only after unlock and is audited.

---

## B10 — Inventory

**Read:** `modules/05-inventory.md`.

**Build:**
- **Masters:** raw materials (categories, purchase ↔ consumption units with conversion, min/max/at-par levels), suppliers, units, and recipes (item/variation/area-specific).
- **Consumption:** automatic consumption on sale and stock revert on cancel.
- **Documents:** purchase, purchase order (T&C, taxes, ship-to/bill-to, backdate policy), purchase return, sale, transfer, sales return and wastage (with approval). Each has a status, payment status, PDF template and email.
- **Stock counts:** available and closing stock counts with Excel import and freeze, and weighted-average costing.
- **Production:** production master and execution, plus barcode generation.
- **Reports and settings:** Current Stock, Stock Summary, Orderwise Consumption; settings with copy-to-outlet and a config log; and automatic item on/off when stock runs out.

**Acceptance:** selling an item deducts its recipe quantities; closing stock − expected = variance report; COGS is available to the dashboard margin widget.

---

## B11 — Payments, accounting & finance

**Read:** `modules/08-accounting-payments.md`, `modules/13-finance.md`.

**Build:**
- **Payments:** a payment-provider abstraction (UPI QR, EDC, PG) and a payout tracker with the status chain from `08` §1. Bank accounts, the Payment Information list with export, and GST billing profile.
- **Service billing:** history tabs (subscription invoices, MDR, hardware, deposits, ledger) and loans (read-only).
- **Finance:** a dashboard covering tender split, payout summary, and cash reconciliation (missing amount = opening + cash bills − closing). Plus a transactions explorer, expense analytics, and Leakage Watch rules: payment without a bill, a bill without a payment, amount mismatch, discount/cancel/NC outside policy, and a KOT without a bill.
- **Accounting:** export to Tally/Zoho (voucher mapping via SAP codes).

**Acceptance:** seeded leakage scenarios are each flagged exactly once with an exposure amount.

---

## B12 — Ecosystem clients

**Read:** `modules/14-ecosystem-apps.md`, `09` §3, `07` §10 (KDS, Captain App).

**Build (each optional, behind entitlements):**
- Captain ordering app (table → KOT; discount permission).
- KDS: item/KOT done, which syncs to the order screen and triggers a food-ready notification.
- Token display.
- Self-order kiosk and QR scan-and-order (menu flags K/D).
- Own website ordering.
- Digital display (media playlists per device).
- Waiter calling device events.

All clients use the B0 pairing flow and the B5 sync protocol.

**Acceptance:** a captain-punched KOT appears on the KDS and the POS within 2 seconds on the LAN.