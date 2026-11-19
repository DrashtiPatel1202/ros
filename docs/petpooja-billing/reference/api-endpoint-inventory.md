# API / AJAX endpoint inventory (observed)

**Source:** inline `<script>` URL literals and `<form action>` in server-rendered HTML of each page (2026-11-19). These are **Petpooja's internal endpoints** — use them to understand capabilities and naming, not as a contract. HTTP methods were not observed for most AJAX calls; jQuery `$.post`/`$.ajax` POST with form-encoded `data[Model][field]` bodies is the dominant pattern (CakePHP-style). Responses are mostly HTML fragments or JSON.

## Conventions observed

| Pattern | Meaning |
| --- | --- |
| `/{controller}/{entity}_list/` | Page shell |
| `/{controller}/{abbrev}list/` (e.g. `ordlist`, `klist`, `catlist`) | Paged grid data (AJAX) |
| `/{controller}/{entity}/` | Add/edit form (popup or page) |
| `/{controller}/{entity}_detail/` | Detail popup |
| `/{controller}/delete_*`, `remove_*` | Delete |
| `/{controller}/*_import_csv/`, `export_*` | Bulk import/export |
| `…/{restaurant_id}` suffix | Outlet scope |

## Global (every page)

`/logs/get_header_notifications/` · `/menus/recent_menu_changes` · `/inventory_reports/inventory_notification_new/` · `/inventories/inventory_quick_start/` · `/users/community_sso/1/` · `/logs/update_cta_actions` · `/configurations/save_mapping_code/` · `/users/get_sync_code/{n}` · `/users/set_client_key` · `/app/check_item_with_empty_hsn/` · `/users/save_employee_activity_logs`

## Dashboard

`/dashboard/save_fssai/` · `/dashboard/attendo_api/`

## Orders

| Endpoint | Purpose |
| --- | --- |
| `/orders/ordlist/` | All orders grid |
| `/orders/order_detail/`, `/orders/order_kot_detail` | Detail |
| `/orders/order_edit/`, `/orders/order_save/`, `/orders/get_item_taxes/` | Edit bill |
| `/orders/change_payment_type/` | Change payment |
| `/orders/save_cancel_order/{id}` | Cancel |
| `/orders/remove_order_billing`, `/orders/delete_order_data_billing/` | Remove (OTP) |
| `/orders/get_platform_list/`, `/onlines/missing_invoice_list/` | Missing online invoices |
| `/orders/show_running_orders/{id}` | Live orders |
| `/orders/dayendsummary/`, `/orders/day_end_summary_detail/`, `/orders/send_dayend_otp/`, `/orders/delete_dayend_data/` | Day end |
| `/orders/deliveryserviceslist/` | Delivery mgmt |
| `/items/klist/`, `/items/kot_detail/` | KOT |

## Online orders

`/onlines/ajax_load_online_orders/` · `/onlines/ajax_new_online_orders/` · `/onlines/ajax_update_online_orders/` · `/onlines/order_details/` · `/onlines/thirdparty_order_details/` · `/onlines/view_cancel_order/` · `/onlines/ajax_cancel_order/` · `/onlines/generate_invoice/` · `/onlines/swiggy_special_request_action/` · `/onlines/ajax_online_order_dashboard_chart/` · `/onlines/instructions_popup/` · `/onlines/get_tp_webhook_logs/` · `/onlines/download_order_report/` · `/onlines/reconciliationlist_new/`

## Menu (menu.petpooja.com)

Sync: `/menus/sync_menu_request/{id}` · `/menus/menu_sync_status/` · `/menus/ho_outlet_sync_status/` · `/menus/ho_menu_sync_status/` · `/ho/get_ho_tax_push_noti/1`
Items: `POST /menus/menu_item_list_new`
Category: `/items/catlist/` · `/items/category/` · `/items/update_rank_category/` · `/items/update_timings/` · `/items/fetch_restaurant_areas/` · `/items/update_dinein_areas` · `/menus/change_order_type/` · `/items/expose_remove_category/` · `/items/setorder/` · `/items/check_item_exist/` · `/items/check_assign_cwt_grp/` · `/items/category_import_csv/` · `/menus/multiple_category_update_image/`
Variation: `/items/varlist/` · `/items/variation/` · `/menus/update_variation/` · `/items/import_variation/` · `/items/export_variation/{id}`
Addon: `/items/addonlist/` · `/items/addon/` · `/items/addon_detail/` · `/items/addon_zone_price/` · `/items/addon_item_update_areawise/` · `/items/update_addon_group_rank/` · `/items/show_remove_addon_status/` · `/menus/update_item_addons_new/` · `/items/upload_addon_group_csv/` · `/items/addon_export_layout/` · `/items/export_import_restricted_addon_data/` · `/ho/get_restaurant_list`
Tables: `/menus/restableslist/` · `/menus/restables/` · `/menus/remove_table` · `/items/table_import_csv/` · `/menus/add_discount_res_areas_tables/`
Tax: `/items/tlist/` · `/items/tax/` · `/items/tax_view_load_ajax/` · `/items/get_rest_categories_item_tax/` · `/items/get_category_items/` · `/items/remove_tp_retained_tax_pos/` · `/items/backward_tax/` · `/items/cess_tax/` · `/items/tax_setting/` · `/items/copy_tax_to_outlet/` · `/items/area_to_area_copy_tax/` · `/items/export_item_tax/` · `/items/export_consolidated_tax_layout/` · `/items/delete_tax` · `/menus/itemwise_tax_details/` · `/menus/item_changes/` · `/items/reset_bill_no/`
Discount: `/items/dlist/` · `/items/discount/` · `/items/discount_detail/` · `/items/get_rest_categories/` · `/items/get_rest_categories_item/` · `/items/get_rest_categories_bogo/` · `/items/get_rest_categories_item_bogo/` · `/items/get_discounts/` · `/items/get_os_outlets/` · `/items/get_irctc_outlets/` · `/items/copy_discount_to_outlet/` · `/items/copy_discount` · `/items/discount_copy_progress/` · `/items/discount_copy_progress_seen/` · `/items/discount_trigger/` · `/ho/copy_online_discount` · `/ho/push_online_discount` · `/items/export_discount_item_sheet/{1|2}`
Preferences: `/items/spnote_list/` · `/items/specialnote/` · `/items/special_note_detail/` · `/items/update_rank_order_preference/` · `/items/remove_note/{id}/{slug}` · `/export_importmenu/import_item_special_notes/`
Commission: `/items/menucommlist/` · `/items/menucommission/` · `/menus/update_item_commission/`
Other: `/menus/physical_menu` · `/menus/virtual_brand/`

## Outlet configuration

`/users/res_new_save/` · `/users/res_setting_save/{id}` · `/users/get_states/` · `/users/get_cities/` · `/app/search_gst_details/` · `/configurations/search_configurations` · `/configurations/copy_config/` · `/users/remove_pos_server/` · `/users/remove_pos_server_btn/` · `/users/save_pos_configuration/` · payment types `/users/add_custom_ptype` `/users/change_custom_ptype` `/users/change_main_ptype` `/users/add_pcard_option` `/users/change_payment_card_option` `/users/add_upi_type` `/users/change_upiopt` · negative qty reasons `/users/add_negative_quantity_reason` `/users/change_negative_quantity_reason` · invoice sequence `/users/resinvoice_list/` `/users/res_invoice/` · floor `/users/floor_listing/` `/users/add_floor_plan/` · sub order type `/items/sub_order_typelist/` `/items/sub_order_type/` `/items/delete_suborder_type` · delivery distance `/items/deliverydistancelist/` `/items/delivery_distance/` · area charges `/users/areawisedeliverychargelist/` `/users/area_wise_delivery_charge/`

## Accounting

`/orders/reconcilationlist/` · `/users/download_payout_report/` · `/paid_services/view_paid_service_info/` · wallet (15 endpoints, see [module](../modules/08-accounting-payments.md#2-virtual-wallet--usersvirtual_wallet_list)) · `/users/gst_information/` · `/users/get_gst_city/` · `/orders/bankdetaillist/` · `/orders/add_bank_details/` · `/orders/delete_bank_detail/` · `/items/expenselist/` · `/items/expense_detail/` · `/orders/phlist/` · `/orders/add_credit_service/` · `/orders/loanlist/` · `/orders/loan_invoice_detail/` · `/items/denomination_list_ajax/` · `/items/denomination/`

## Users & devices

`/users/desklist/` · `/users/desktop_user/` · `/users/desktop_user_detail/` · `/users/get_user_groups/` · `/users/activate_integrate_app/` · `/users/view_biller_user_changes/` · `/users/get_sync_code` · `/users/rest_desktop_user/` · `/users/update_2fa` · `/users/editprofile/yes` · `/users/user_details/` · `/users/add_quick_links_ajax/` · `/users/sidebar_quick_link/`

## Logs

`/logs/online_log_status_ajax/{1|2}` · `/logs/auto_accept_log_status_ajax/` · `/logs/supportlist/` · `/logs/notifications_list_ajax/` · `/logs/closing_hours_logs_ajax/` · `/logs/expense_logs_ajax/{expenses_logs|withdrawals_logs|cash_top_ups_logs}` · `/logs/get_outlets/` · `/admins/restaurant_list/all` · `/admins/get_restaurant/1` · `/settings/zomato_menu_callbacks_ajax/` · `/settings/zomato_menu_callbacks_layout/` · `/settings/track_menu_status/` · `/settings/update_menu_status/` · `/settings/download_s3_menu_file/`

## Reports

`/custom_reports/rlist/0` · `/custom_reports/report_noti/` · `/custom_reports/add_report_notification/` · `/users/get_token_with_url/`

## CRM

`/crm/crmdashboard/` · `/crm/add_segment/` · `/crm/view_segment_detail/` · `/crm/change_segment_status/` · `/crm/delete_segment/` · `/crm/refresh_segment/` · `/crm/create_campaign/` · `/crm/save_campaign/` · `/crm/test_campaign/` · `/app/campaign_credit_count/` · `/users/smshistory/` · `/users/create_sms_campaign/` · `/users/add_sms_campaign/` · `/users/cancel_campaign/` · `/users/sms_detail/` · `/users/reschedule_campaign/` · `/users/reschedule_detail` · `/users/activate_campaign/` · `/users/clist/` · `/users/customer/` · `/users/customer_discount/` · `/users/customer_unlock/` · `/users/update_session_unmask_phoneno` · `/feedbacks/applist/` · `/feedbacks/order_detail/`

## Marketplace & payments

`/market/*` (see [module](../modules/12-marketplace-integrations.md#marketplace-settings--marketsettings)) · `/market/verify_marketplace_promocode_apply/` · `/zaakpays/payment_initiate` · `/zaakpays/check_payment_response/` · `/zaakpays/phonepe_response/` · `/zaakpays/free_service/{service}`

## Inventory (inventory.petpooja.com)

Pages listed in [module](../modules/05-inventory.md#navigation); AJAX endpoints not enumerated in this pass.