# Dashboard (`/users/dashboard`)

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** live browser observation + server HTML parse (demo account, single outlet, no sales)

## Purpose

The landing page after login. It combines today's sales KPIs, AI-style insights ("Daily Snapshot", "Risk Radar"), onboarding nudges and cross-sell cards for other Petpooja products.

## Global shell (present on every billing page)

| Area | Contents |
| --- | --- |
| Top bar | Outlet switcher (`{outlet name}` + "N brands"), notifications bell (count), **Explore Products** mega-menu, **AI Agent** launcher, profile menu |
| Profile menu | Edit Profile, Petpooja Apps (version e.g. `129.0.1`), Terms & Conditions, Privacy Policy, Logout |
| Product switcher | Bazaar, Reconciliation, Insights, Marketplace, Orders, Suppliers, Menu, Inventory, Reports |
| Explore Products mega-menu | PRODUCTS: Attendo (payroll), Task (project mgmt), Finance, Marketing Automation, TRM (table reservations), Purchase (AI inventory). OPERATIONS: Captain Ordering App, Kitchen Display System, Website, Kiosk. INTEGRATIONS: Dynamic Reports, Online Orders, Accounting, Loyalty |
| Left sidebar | Full navigation tree — see [route-map](./reference/route-map.md) |
| Quick Links | User-pinned shortcuts (`/users/add_quick_links/`) |
| Need Help | Request a Call Back (phone), WhatsApp support, support email/phone |
| AI Agent drawer | Chat assistant with suggested prompts (see below) and chat history |
| Device mapping modal | "Map Device With {outlet}" — enter mapping code shown on device; or generate a secure sync code (password-confirmed). Connects Feedback App, Scan & QR, Android POS (Bijlipay) |

### AI Agent suggested prompts (observed)

- Ask to generate graphs: "Generate a graph for next weeks sales report", "Predict profit and loss for next month", "Get me an item-wise profit and loss"
- Ask anything about your business: "What were my top-selling items yesterday?", "How much did I earn last month?", "What was my online sales channel-wise last quarter?"
- Get help: "How do I connect to customer support", "How do I add a new item in the menu", "How can I create a new outlet"

## Dashboard widgets

| Widget | Content | Controls |
| --- | --- | --- |
| Daily Snapshot banner | "Your Daily Snapshot is ready — yesterday's performance across sales, orders, customers & loyalty"; sub-cards "Customers loved you yesterday", "Silent revenue killers", "No sales to compare yet" | Open snapshot, Skip |
| Sync status | "POS synced N days ago", "Orders synced N days ago" | — |
| Sales Statistics | Total sales today, order count | Date range: Today / Yesterday / Last 7 Days / Last 30 Days / This Month / Last Month / Custom Range |
| Sales chart | Daily, stacked by channel (Dine In, Pick Up, Delivery) | Toggle series; chart type Column / Area / Line; Highcharts export menu |
| Channel cards (Dine In / Pick Up / Delivery) | No. of orders, Min, Avg, Max, Discount, Taxes, Total, T.T.A avg (turnaround) | — |
| Online orders | Total; orders settled by aggregator; COD cash to collect | Table: Platform, Orders, Prepaid orders, COD orders, Revenue |
| Item margin vs city benchmark | Your margin % vs city %, Top 5 margin differences; CTA "Turn on Inventory to see your actual food cost" | — |
| Item Performance | Top Performing / Low Performing toggle | — |
| Expenses & Withdrawals | Expense, withdrawal, cash top-up totals | Date range |
| Onboarding Progress | Remaining setup steps | Complete setup |
| Staff Cost vs Sales (Attendo upsell) | Sales vs staff cost bars, on-time %, overtime | Connect Organisation ID (OTP to org owner), See Sample Report → `/users/attendo_staff_cost_breakdown` |
| Risk Radar | Unverified payments by tender; checks: payment matched to bill, billed = collected, every bill has payment | Explore Risk Analysis → Finance |
| Expense Drain | Unverified expenses; KharchaPay (UPI staff wallets) upsell | Explore KharchaPay |
| Counter Giveaways | Discounts / cancels / freebies outside policy | — |
| Sales Performance, Retention % | Repeat-customer rate | Explore Marketing Manager |
| Revenue Leakage | KOTs vs Bills mismatch | — |
| Quick Help | Named point of contact, hours 10 AM–7 PM | WhatsApp |
| Action Center (right drawer) | Alerts: items missing description, items missing photos, Tax Configuration, FSSAI Lic No. | Each alert opens a fix-it modal (Save / Ignore now) |

## Modals on dashboard

| Modal | Fields | Endpoint (observed) |
| --- | --- | --- |
| Connect Organisation ID (Attendo) | Org ID, OTP | `/dashboard/attendo_api/` |
| Tax Configuration | Select taxes per listed item | — |
| Item Description | Description per item | — |
| Upload Item Image | Image per item | — |
| FSSAI Lic No. | `d_fssai` | `POST /dashboard/save_fssai/` |

## Endpoints called by every page (global)

`/logs/get_header_notifications/`, `/menus/recent_menu_changes`, `/inventory_reports/inventory_notification_new/`, `/inventories/inventory_quick_start/`, `/users/community_sso/1/`, `/logs/update_cta_actions`, `/configurations/save_mapping_code/`, `/users/get_sync_code/{n}`, `/users/set_client_key`, `/app/check_item_with_empty_hsn/`, `/users/save_employee_activity_logs`.

## Implementation notes

- Every KPI widget should load independently (each shows its own "Issue while getting the data — Retry" error state).
- Date-range presets are reused across all widgets and list pages.
- Upsell widgets are driven by subscription state (see [marketplace](./modules/12-marketplace-integrations.md)).