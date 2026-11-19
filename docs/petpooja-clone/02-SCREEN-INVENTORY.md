# Screen inventory — clone status

**Extent key**

| Tag | Meaning |
| --- | --- |
| **Must clone** | Required for "complete billing.petpooja.com clone" |
| **Must clone (sub-app)** | Required because billing navigates here |
| **Capture then clone** | In complete-software scope, but observation is thin |
| **Behavioural depth** | How much `petpooja-billing` already documents the screen |

**Implementation status** (fill during development; all start as Not started)

| Tag | Meaning |
| --- | --- |
| Not started | No clone UI |
| Shell only | Route + Petpooja-like chrome, empty body |
| Partial | Some filters/actions; missing Petpooja parity |
| Full | Matches module + UI fidelity checklist |

Spec links point at `../petpooja-billing/…`.

---

## Global (all pages)

| Surface | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Auth sign-in + session + logout | Must clone | reviewed | Partial | [01-authentication](../petpooja-billing/01-authentication.md) |
| Header / sidebar / Explore Products / AI Agent / Need Help / device map / Quick Links / profile | Must clone | reviewed | Partial | [02-dashboard § Global shell](../petpooja-billing/02-dashboard.md) |
| Product switcher destinations | Must clone | partial | Not started | [00-overview](../petpooja-billing/00-overview.md), [14](../petpooja-billing/modules/14-ecosystem-apps.md) |

---

## Dashboard

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| `/users/dashboard` widgets + Action Center + Daily Snapshot + Risk / Expense / Retention cards | Must clone | reviewed | Partial | [02-dashboard](../petpooja-billing/02-dashboard.md) |
| Dynamic Dashboard (`dashboard.petpooja.com`) | Must clone (sub-app) | partial (separate login) | Not started | [14](../petpooja-billing/modules/14-ecosystem-apps.md), [04-GAP-CAPTURE](./04-GAP-CAPTURE.md) |

---

## Daily Operations

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Live Orders | Must clone | reviewed | Partial | [03 §1](../petpooja-billing/modules/03-orders-billing.md) |
| All Orders (+ Advance, remove OTP, generate invoice) | Must clone | reviewed | Partial | [03 §2](../petpooja-billing/modules/03-orders-billing.md) |
| Online Orders inbox + lifecycle | Must clone | reviewed | Not started | [03 §3](../petpooja-billing/modules/03-orders-billing.md) |
| Dynamic Reports / Insights handoff | Must clone | partial | Not started | [06](../petpooja-billing/modules/06-reports.md) |
| KOT list | Must clone | reviewed | Not started | [03 §4](../petpooja-billing/modules/03-orders-billing.md) |

---

## Menu (`menu.petpooja.com`)

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Menu Management home | Must clone (sub-app) | reviewed | Not started | [04](../petpooja-billing/modules/04-menu-management.md) |
| All In One Menu (Items/Categories/Variants/Addons/Tables/Taxes/Discounts) | Must clone (sub-app) | reviewed (add/edit popups partial) | Not started | [04 §2](../petpooja-billing/modules/04-menu-management.md) |
| Schedule Changes | Must clone (sub-app) | partial | Not started | [04](../petpooja-billing/modules/04-menu-management.md) |
| Multi-Item Images Upload | Must clone (sub-app) | reviewed | Not started | [04 §3](../petpooja-billing/modules/04-menu-management.md) |
| Menu on/off | Must clone (sub-app) | reviewed | Not started | [04 §4](../petpooja-billing/modules/04-menu-management.md) |
| Order Preferences | Must clone (sub-app) | reviewed | Not started | [04 §5](../petpooja-billing/modules/04-menu-management.md) |
| Item Commission | Must clone (sub-app) | reviewed | Not started | [04 §6](../petpooja-billing/modules/04-menu-management.md) |
| Physical Menu | Must clone (sub-app) | reviewed | Not started | [04 §7](../petpooja-billing/modules/04-menu-management.md) |
| Virtual Brand | Must clone (sub-app) | reviewed | Not started | [04 §8](../petpooja-billing/modules/04-menu-management.md) |

---

## Inventory (`inventory.petpooja.com`)

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Inventory dashboard + all nav leaves (purchase, PO, returns, stock, production, reports, masters, settings) | Must clone (sub-app) | reviewed | Not started | [05](../petpooja-billing/modules/05-inventory.md) |

---

## Reports

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Day End Summary | Must clone | reviewed | Not started | [03 §5](../petpooja-billing/modules/03-orders-billing.md) |
| Other Reports catalogue (~100) | Must clone | reviewed (per-report columns partial) | Not started | [06](../petpooja-billing/modules/06-reports.md) |
| Report Notification | Must clone | reviewed | Not started | [06](../petpooja-billing/modules/06-reports.md) |
| Delivery Management | Must clone | reviewed | Not started | [03 §6](../petpooja-billing/modules/03-orders-billing.md) |

---

## Management — Configuration

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Outlet Configuration hub + 15 pages | Must clone | reviewed | Not started | [07](../petpooja-billing/modules/07-outlet-configuration.md) |
| Sub Order Type | Must clone | reviewed | Not started | [07](../petpooja-billing/modules/07-outlet-configuration.md) |
| Delivery Distance | Must clone | reviewed | Not started | [07](../petpooja-billing/modules/07-outlet-configuration.md) |
| Area/Locality Delivery Charges | Must clone | reviewed | Not started | [07](../petpooja-billing/modules/07-outlet-configuration.md) |
| Floor Plan | Must clone | reviewed | Not started | [07 §6](../petpooja-billing/modules/07-outlet-configuration.md) |

---

## Management — Accounting

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Payment Information | Must clone | reviewed | Not started | [08 §1](../petpooja-billing/modules/08-accounting-payments.md) |
| Virtual Wallet | Must clone | reviewed | Not started | [08 §2](../petpooja-billing/modules/08-accounting-payments.md) |
| Online Order Reconciliation | Must clone | reviewed | Not started | [08 §3](../petpooja-billing/modules/08-accounting-payments.md) |
| GST Information | Must clone | reviewed | Not started | [08 §4](../petpooja-billing/modules/08-accounting-payments.md) |
| Bank Details | Must clone | reviewed | Not started | [08 §5](../petpooja-billing/modules/08-accounting-payments.md) |
| Expense & Withdrawal | Must clone | reviewed | Not started | [08 §6](../petpooja-billing/modules/08-accounting-payments.md) |
| Service Payment History | Must clone | reviewed | Not started | [08 §7](../petpooja-billing/modules/08-accounting-payments.md) |
| Loan Information | Must clone | reviewed | Not started | [08 §8](../petpooja-billing/modules/08-accounting-payments.md) |
| Denomination | Must clone | reviewed | Not started | [08 §9](../petpooja-billing/modules/08-accounting-payments.md) |

---

## Users, devices, logs, marketplace, CRM

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Biller App users | Must clone | reviewed | Not started | [09](../petpooja-billing/modules/09-users-devices.md) |
| Device Mapping | Must clone | reviewed | Not started | [09](../petpooja-billing/modules/09-users-devices.md) |
| Petpooja Apps download centre | Must clone | reviewed | Not started | [09](../petpooja-billing/modules/09-users-devices.md) |
| Edit Profile / 2FA | Must clone | reviewed | Not started | [01](../petpooja-billing/01-authentication.md), [09](../petpooja-billing/modules/09-users-devices.md) |
| All User Logs pages + Support | Must clone | reviewed | Not started | [10](../petpooja-billing/modules/10-logs-audit.md) |
| Audit Trail app | Must clone (sub-app) | partial | Not started | [10](../petpooja-billing/modules/10-logs-audit.md) |
| Marketplace services / integrations / settings | Must clone | reviewed | Not started | [12](../petpooja-billing/modules/12-marketplace-integrations.md) |
| CRM Marketing / Campaigns / Customers / Feedback / Loyalty / Google Business | Must clone | reviewed (Google Business none) | Not started | [11](../petpooja-billing/modules/11-crm-marketing.md) |
| Marketing Automation app | Must clone (sub-app) | landing only | Not started | [11 §7](../petpooja-billing/modules/11-crm-marketing.md) |
| Aggregator Center (Swiggy help) | Must clone | partial | Not started | [12](../petpooja-billing/modules/12-marketplace-integrations.md) |

---

## Finance + ecosystem

| Screen | Priority | Spec depth | Impl | Spec |
| --- | --- | --- | --- | --- |
| Finance SPA (Dashboard, Transactions, Expenses, Leakage, Marketplace) | Must clone (sub-app) | reviewed | Not started | [13](../petpooja-billing/modules/13-finance.md) |
| Attendo / Tasks / TRM / Purchase / Bazaar / Suppliers | Capture then clone | partial / not opened | Not started | [14](../petpooja-billing/modules/14-ecosystem-apps.md) |
| Captain / KDS / Kiosk / Website / Token / Scan & Order / Digital Display | Capture then clone | download + marketing only | Not started | [09](../petpooja-billing/modules/09-users-devices.md), [14](../petpooja-billing/modules/14-ecosystem-apps.md) |
| Desktop / Android POS billing screen | Capture then clone | settings only via outlet config | Partial (`/pos/billing`) | [07](../petpooja-billing/modules/07-outlet-configuration.md), [04-GAP-CAPTURE](./04-GAP-CAPTURE.md) |

---

## Totals (planning)

| Priority | Approx. surfaces |
| --- | --- |
| Must clone (billing + menu + inventory + finance + audit + marketing entry) | ~70+ screens / hubs |
| Capture then clone | ecosystem apps + POS client + deep Dynamic Dashboard |

Update the **Impl** column as waves complete. Do not mark Full without the UI fidelity checklist in [01-UI-FIDELITY.md](./01-UI-FIDELITY.md).