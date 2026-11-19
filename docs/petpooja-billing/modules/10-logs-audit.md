# Module: User Logs & Audit Trail

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** server HTML parse + live view of `audit.petpooja.com`

## Log pages (billing portal)

| Log | Route | Filters | Data endpoint |
| --- | --- | --- | --- |
| Online Store Logs | `/logs/online_log_status/1` | From/To, Outlet (multi), Record Type (Latest / Old) | `/logs/online_log_status_ajax/1/` |
| Online Item On/Off Logs | `/logs/online_log_status/2` | + Search ItemID/Name | `/logs/online_log_status_ajax/2` |
| Auto Accept Change Logs | `/logs/auto_accept_log_status/` | From/To | `/logs/auto_accept_log_status_ajax/` |
| Support Management | `/logs/support_note_list/` | Support No., Category, date | `/logs/supportlist/` |
| Notifications | `/logs/notifications_list/` | — | `/logs/notifications_list_ajax/` |
| Online Menu Trigger Logs | `/settings/zomato_menu_callbacks/` | From/To, Thirdparty user, Client Restaurant ID, Request Id, Status (Success, Failed, In Process) | `/settings/zomato_menu_callbacks_ajax/`; track `/settings/track_menu_status/`; download menu JSON `/settings/download_s3_menu_file/` |
| Closing Hours Logs | `/logs/closing_hours_logs/` | From/To | `/logs/closing_hours_logs_ajax/` |
| Expense Logs | `/logs/expense_logs/` | From/To, Update Type (Update, Removed) | `/logs/expense_logs_ajax/expenses_logs` |
| Withdrawal Logs | `/logs/withdrawl_logs/` | same | `/logs/expense_logs_ajax/withdrawals_logs` |
| Cash Top-Up Logs | `/logs/cashtopup_logs/` | same | `/logs/expense_logs_ajax/cash_top_ups_logs` |

Common: Search, Reset, Export. Outlet pickers use `/admins/restaurant_list/all`, `/logs/get_outlets/`.

**Support Management categories** (`notes_type`): Re-installation, Installation, Printer Issue, EDC Issue, Loan Amount Issue, Reconciliation Issue, Billing Issue, Payment Issue, GST Issue, Report Issue, KOT Issue, Inventory Issue, Reset Bill No, Printer Configuration, Menu Issue, Discount Configuration, Account Details Issue, Login Issue, Training Issue, … (~35). These are support tickets/notes raised by Petpooja support for the outlet.

## Audit Trail — `audit.petpooja.com` (via `/users/logs_redirect`)

"Every action across your account — logged, searchable, and timestamped." Sidebar: **Overview · Management · Report**. Retention: **last 180 days**. Category-based browsing ("Select a category on the left to view activity").

## Implementation guidance

- Use one **append-only audit event table**: `{id, tenant_id, outlet_id, actor(type,id,name), source(web|pos|captain|api|system), entity_type, entity_id, action, before, after, reason, ip, device_id, created_at}`; derive the specialised log pages as filtered views.
- Third-party menu pushes need a **request log** with status and downloadable payload.
- Enforce 180-day retention (or plan-based).