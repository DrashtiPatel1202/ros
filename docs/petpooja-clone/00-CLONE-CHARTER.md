# Clone charter

**Last verified against live UI:** 2026-11-19  
**Primary URL:** `https://billing.petpooja.com/users/dashboard`  
**Product version observed:** Petpooja Apps Version `129.0.1` (profile menu)

## Definition of done

The clone is done when:

1. **Navigation parity** — every sidebar item, header control, and profile menu entry from the live billing portal exists and routes to an equivalent screen (or a documented stub that looks like Petpooja's empty/upsell state).  
2. **Feature parity** — for each screen marked **Must clone** in [02-SCREEN-INVENTORY.md](./02-SCREEN-INVENTORY.md), behaviour matches the corresponding `petpooja-billing` module (filters, actions, modals, validations, status machines).  
3. **UI parity** — layout, chrome, typography, spacing language, component patterns, and page structure match the live product per [01-UI-FIDELITY.md](./01-UI-FIDELITY.md). Side-by-side screenshots of shell + major list pages should be indistinguishable at a glance (aside from brand assets you choose to replace).  
4. **Data fidelity** — money, tax, order, menu, and outlet models support the same operator workflows Petpooja exposes (not a reduced "MVP order notepad").  

"Looks similar but fewer buttons" is **failure**.

## In scope (clone)

### Core host: `billing.petpooja.com`

- Global shell (header, sidebar, notifications, Explore Products, AI Agent, Need Help, device mapping, Quick Links, product switcher, profile menu)  
- Dashboard and every Daily Operations / Reports / Management / CRM / Marketplace / Aggregator Center leaf that lives on billing  
- Outlet configuration (all 15 cards + related lists)  
- Accounting & payments pages  
- Users, devices, apps, logs  
- CRM pages still on billing (customers, campaigns, feedback, loyalty entry, legacy marketing)  

### Linked sub-apps that open from billing (same session or SSO redirect)

Treat these as **in scope for a complete clone** of "what the dashboard opens":

| Host | Why it is in scope |
| --- | --- |
| `menu.petpooja.com` | Menu & discounts from sidebar |
| `inventory.petpooja.com` | Inventory from sidebar |
| `finance.petpooja.com` | Finance (New) |
| `marketing.petpooja.com` | Marketing Automation (New) |
| `audit.petpooja.com` | Audit Trail (New) |
| `dashboard.petpooja.com` | Dynamic Dashboard (New) — may need separate login today; still clone the entry + product |
| Token-handoff Insights / Dynamic Reports | `/users/data_analytics` |

### Ecosystem products linked from Explore Products / Marketplace

Attendo, Tasks, TRM, Purchase, Bazaar/Suppliers, device apps (Captain, KDS, Kiosk, Website, etc.): **in scope as product surfaces** for a "complete software" clone. Capture depth varies — see [04-GAP-CAPTURE.md](./04-GAP-CAPTURE.md). Until captured, ship Petpooja-like landing/upsell pages rather than inventing a different UI.

## Explicit non-goals for the first clone wave (document, don't invent)

These are still part of the long-term complete clone, but they are **blocked on capture** or are **POS binaries**, not the billing website:

- Pixel-perfect recreation of every Highcharts series colour without extracting assets  
- Official Petpooja proprietary logos/images **unless you replace them with licensed or original art** while keeping the same layout slots  
- Desktop/Android POS native binaries (clone the **behaviour and settings** Petpooja exposes; shipping identical .exe/.apk is a separate programme)  
- Calling real Zomato/Swiggy production APIs until connectors exist — UI and state machines still clone Petpooja  

## Architecture stance for the clone

Petpooja is a hybrid: **cloud back-office + offline-capable POS**. The clone must plan for:

1. Multi-tenant org → brand → outlet  
2. Server-driven list pages (CakePHP-style patterns can be replaced internally, but **API surface and UI stay Petpooja-like**)  
3. Separate menu/inventory hosts or path prefixes that feel like Petpooja's multi-host product  
4. Entitlements gating Marketplace products  
5. Append-only audit for sensitive actions  

Internal stack is yours (recommended: TypeScript API + React admin that **visually mirrors** Petpooja, Postgres, Redis). Do **not** reuse the REA Counter MVP UI as the billing shell.

## Legal / brand note

Petpooja is a trademark of Prayosha Food Services Pvt. Ltd. This pack describes observed product behaviour for your rebuild. Decide with counsel whether the shipping product uses Petpooja branding or a white-label shell that still matches layout and UX. **Do not commit live credentials, tokens, or customer PII into the repo.**

## Relationship to the REA Counter MVP

`apps/web` + `apps/api` counter is a **separate thin experiment**. For the clone:

- Do not extend that UI into "Petpooja".  
- Optionally keep its pricing package / Postgres practices as libraries.  
- Mark clone progress only in this pack's inventory, not in `docs/mvp/FEATURE-STATUS.md`.