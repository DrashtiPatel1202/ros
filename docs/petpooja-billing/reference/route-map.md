# Route map (sidebar → URL)

**Last verified:** 2026-11-19. `{id}` = restaurant (outlet) id. Host is `billing.petpooja.com` unless stated.

```
Dashboard ............................. /users/dashboard/
Dynamic Dashboard (New) ............... /users/ai_report_redirect → dashboard.petpooja.com
Daily Operations
  Live Orders ......................... /orders/running_orders/
  All Orders .......................... /orders/order_list/
  Online Orders ....................... /onlines/online_dashboard/
  Dynamic Reports ..................... /users/data_analytics
  KOT ................................. /items/kot_list/
Menu (menu.petpooja.com)
  Menu & Discounts .................... /menus/menu_management
  Multi-Item Images Upload ............ /menus/upload_item_images
  Menu on/off ......................... /menus/item_on_off/
Inventory (inventory.petpooja.com) .... /inventory_dashboard/new_inventory_dashboard/
Marketing Automation (New) ............ /users/marketing_redirect → marketing.petpooja.com
Finance (New) ......................... /users/finance_redirect → finance.petpooja.com
Reports
  Day End Summary ..................... /orders/day_end_summary/
  Other Reports ....................... /custom_reports/reports/
  Report Notification ................. /custom_reports/report_notifications/
  Delivery Management ................. /orders/delivery_services_list/
Management
  Configuration
    Outlet Configuration .............. /users/res_new/{id}
    Sub Order Type .................... /items/sub_order_type_list/
    Delivery Distance ................. /items/delivery_distance_list/
    Area/Locality Delivery Charges .... /users/area_wise_delivery_charge_list/
    Floor Plan ........................ /users/floor_plan/
  Accounting
    Payments
      Payment Information ............. /orders/reconcilation_list/
      Virtual Wallet .................. /users/virtual_wallet_list/
    Online Order Reconciliation ....... /onlines/reconciliation_list_new/
    GST Information ................... /users/gst_information/
    Bank Details ...................... /orders/bank_detail_listing/
    Expense & Withdrawal .............. /items/expense_list/
    Service Payment History ........... /orders/invoice_credit_service_list/
    Loan Information .................. /orders/loan_invoice_list/
    Denomination ...................... /items/denomination_list/
  User Management
    Biller App ........................ /users/desktop/
  User Logs
    Online Store Logs ................. /logs/online_log_status/1
    Online Item On/Off Logs ........... /logs/online_log_status/2
    Auto Accept Change Logs ........... /logs/auto_accept_log_status/
    Support Management ................ /logs/support_note_list/
    Notification ...................... /logs/notifications_list/
    Menu Trigger Logs ................. /settings/zomato_menu_callbacks/
    Closing Hour Logs ................. /logs/closing_hours_logs/
    Expense Logs ...................... /logs/expense_logs/
    Withdrawal Logs ................... /logs/withdrawl_logs/
    Cash Top-Up Logs .................. /logs/cashtopup_logs/
  Explore Products
    Marketplace ....................... /market/services/
    Marketplace Setting ............... /market/settings/
  Audit Trail (New) ................... /users/logs_redirect → audit.petpooja.com
  Device Mapping ...................... /users/desktop_application/
CRM
  Marketing ........................... /crm/crm_dashboard/
  Campaign ............................ /users/send_sms_history/
  Google Business (Beta) .............. (no route)
  Customers ........................... /users/customer_list/
  Feedback ............................ /feedbacks/app_list/
  Petpooja Loyalty .................... /market/settings/?s_id=81&from=1 → /market/restaurant_loyalty_details
Aggregator Center
  Swiggy .............................. /users/helpcenter/2
Quick Links ........................... /users/add_quick_links/
Profile
  Edit Profile ........................ /users/edit_profile
  Petpooja Apps ....................... /users/petpooja_application
  Terms / Privacy ..................... /users/terms/, /users/privacy/
  Logout .............................. /users/logout
```

## Outlet Configuration sub-pages

`/users/resdetails/{id}`, `/users/res_contact/{id}`, `/users/res_timing/{id}`, `/users/res_cpt_nqr/{id}`, `/users/res_invoice_list/{id}`, `/users/floor_plan/{id}`, `/users/billing_display_setting/{id}`, `/users/pos_configuration/{id}`, `/users/billing_calculations/{id}`, `/users/connected_services/{id}`, `/users/bill_kot_setting/{id}`, `/users/res_other_setting/{id}`, `/users/pending_order_setting/{id}`, `/users/res_system/{id}`, `/users/res_notification_system/{id}`.

## Menu sub-app (`menu.petpooja.com`)

`/menus/common_screen_menu/`, `/menus/menu_management`, `/menus/menu_new/all`, `/menus/menu_new/all/1` (schedule changes), `/menus/menu_item_list_new` (POST), `/items/category_list/`, `/items/variation_list/`, `/items/addon_list/`, `/menus/res_tables_list/`, `/items/tax_list/`, `/items/tax/`, `/items/discount_list/`, `/items/discount/`, `/menus/upload_item_images`, `/menus/item_on_off/`, `/items/special_note_list/item_note/`, `/items/menucommission_list/`, `/menus/physical_menu/`, `/menus/virtual_brand/`.

## Inventory sub-app (`inventory.petpooja.com`)

See [inventory module](../modules/05-inventory.md#navigation).

## Other hosts

`finance.petpooja.com` (`/`, `/transactions`, `/expenses`, `/leakage-watch`, `/marketplace`, `/welcome`), `audit.petpooja.com`, `marketing.petpooja.com`, `dashboard.petpooja.com`, `payroll.petpooja.com`, `tasksdashboard.petpooja.com`, `reservations.petpooja.com`, `purchase.petpooja.com`, `supplier.petpooja.com`, `bazaar.petpooja.com`. CDNs: `billingcdn.petpooja.com`, `menucdn.petpooja.com`.