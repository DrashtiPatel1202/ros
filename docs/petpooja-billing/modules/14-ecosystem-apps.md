# Module: Ecosystem Products (linked sub-apps)

**Status:** partial (landing / entry level only)
**Last verified:** 2026-11-19

| Product | Entry | Domain | What it is | Observed |
| --- | --- | --- | --- | --- |
| Attendo | Explore Products | `payroll.petpooja.com` | Payroll, attendance, shifts, overtime | Integrated into dashboard "Staff Cost vs Sales" via Org ID + OTP; breakdown page `/users/attendo_staff_cost_breakdown` (Day · Sales · Base pay · Overtime · Extras · Staff cost · Cost % · Sales vs staff cost; adjustments) |
| Petpooja Tasks | Explore Products | `tasksdashboard.petpooja.com` | Task/checklist management for staff | not opened |
| TRM | Explore Products | `reservations.petpooja.com` | Table Reservation Manager | not opened |
| Purchase | Explore Products | `purchase.petpooja.com` | AI inventory / procurement | not opened |
| Suppliers / Bazaar / Hyperpure | Product switcher | `supplier.petpooja.com`, `bazaar.petpooja.com` | B2B marketplace to buy raw materials (incl. Zomato Hyperpure) | not opened |
| Dynamic Dashboard | Sidebar (New) | `dashboard.petpooja.com` | AI/BI dashboard | separate login required |
| Dynamic Reports / Insights | Sidebar | `/users/data_analytics` (token handoff) | Embedded analytics | token-based iframe |
| Audit Trail | Sidebar (New) | `audit.petpooja.com` | See [logs](./10-logs-audit.md) | observed |
| Finance | Sidebar (New) | `finance.petpooja.com` | See [finance](./13-finance.md) | observed |
| Marketing Automation | Sidebar (New) | `marketing.petpooja.com` | See [CRM](./11-crm-marketing.md#7-marketing-automation--marketingpetpoojacom) | landing only |
| Community | header SSO | `/users/community_sso/1/` | Merchant community forum | — |
| AI Agent | header | in-page drawer | Conversational assistant over business data | prompts observed |

## Operations apps (devices)

Captain Ordering App (waiter ordering), Kitchen Display System, Website (own ordering site), Self-Order Kiosk, Token Management, Scan & Order (QR), Waiter Calling Device, Digital Display, MFR scanner, Online Order Acceptance app, Petpooja GO (Android POS). See [devices](./09-users-devices.md#3-petpooja-applications--userspetpooja_application).

## Cross-app SSO pattern

Billing exposes redirect endpoints (`/users/finance_redirect[/SECTION]`, `/users/marketing_redirect`, `/users/ai_report_redirect`, `/users/logs_redirect`, `/users/get_token_with_url/`) that mint a short-lived token and send the user to the sub-app, which then creates its own session. Rebuild with a central identity provider (OIDC) and per-app audiences.