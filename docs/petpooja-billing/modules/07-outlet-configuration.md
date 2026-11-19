# Module: Outlet Configuration (`/users/res_new/{restaurant_id}`)

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** server HTML parse of all 14 configuration pages

The outlet configuration hub lists cards grouped as **Outlet Information · Billing Screen · Online/Advance Order · System Setting · Notification Setting**. A global "Search for all the available configurations" box (`/configurations/search_configurations`) and **copy configuration to another outlet** (`/configurations/copy_config/`) are available. Header shows Restaurant ID and Desktop POS version.

Most pages save via `POST /users/res_setting_save/{restaurant_id}` (Outlet Details uses `/users/res_new_save/`). Field names below are the form keys under `data[Restaurant][...]` (short cryptic keys are kept verbatim — use them only as hints, design your own schema).

| # | Card | Route |
| --- | --- | --- |
| 1 | Outlet Details | `/users/resdetails/{id}` |
| 2 | Contact Details | `/users/res_contact/{id}` |
| 3 | Outlet Timings | `/users/res_timing/{id}` |
| 4 | Payment | `/users/res_cpt_nqr/{id}` |
| 5 | Invoice Sequence | `/users/res_invoice_list/{id}` |
| 6 | Floor Plan | `/users/floor_plan/{id}` |
| 7 | Display (billing screen) | `/users/billing_display_setting/{id}` |
| 8 | Set your print logo | `/users/pos_configuration/{id}` |
| 9 | Calculations | `/users/billing_calculations/{id}` |
| 10 | Connected Services | `/users/connected_services/{id}` |
| 11 | Print (Bill & KOT) | `/users/bill_kot_setting/{id}` |
| 12 | Customer | `/users/res_other_setting/{id}` |
| 13 | Online/Advance Order | `/users/pending_order_setting/{id}` |
| 14 | Billing System | `/users/res_system/{id}` |
| 15 | SMS / Notification | `/users/res_notification_system/{id}` |

Related configuration pages in the sidebar: Sub Order Type, Delivery Distance, Area/Locality Wise Delivery Charges (see end of file).

---

## 1. Outlet Details

Sections: Outlet Information · Address Information · Additional Information

| Field | Key | Notes |
| --- | --- | --- |
| Outlet Name\* | `res_name` | |
| Outlet Alias | `res_alias` | |
| Email | `email` | |
| Country\* / State\* / City\* | `country_id`, `state_id`, `city_id` | cascading (`/users/get_states/`, `/users/get_cities/`); ~58 countries |
| Zip Code\* | `zipcode` | |
| Address\* / Area\* / Landmark | `address`, `area`, `landmark` | |
| Latitude\* / Longitude\* | `lat`, `long` | map picker modal |
| Timezone | `res_timezone` | ~56 IANA zones |
| Fax, Tin No. | `fax`, `tin_no` | |
| Operation Type\* | `operation_type` | COCO, COFO, FOCO, FOFO |
| Cuisines | `cuisines[]` | multi (~40) |
| Seating Capacity | `seating_capacity` | 1-10, 10-50, 50-100, 100+ |
| Logo / Images | file uploads | |
| Restaurant Type | `restaurant_type[1..6]` | e.g. Fine Dine, QSR, Cafe… |
| Online Order Channels | `online_order_channels[]` | Zomato, Swiggy… |
| SAP Code | `sap_code` | ERP; "Validate unique sapcode", "SAP Code mandatory item level" |
| FSSAI Lic No. | `fssai` | |
| Tax Authority Name\* | `g_l` | e.g. GST |
| Supply type | `s_g_f` | Service / Goods / Both |
| Toggles | `v_o_f` variation-wise online on/off; `d_o_k` KOT for online orders; `subpayment_type_report` | |

GST lookup: `/app/search_gst_details/`.

## 2. Contact Details

Owner Mobile\* (`owner_contact_number`), Manager phone, Decision Maker, Direct Number\* (`contact_information`), Biller Name, Biller Phone.

## 3. Outlet Timings

| Section | Fields |
| --- | --- |
| Closing timings | Closing hour (`working_hours[0..1]` HH:MM), toast for temporary extended hours, 24×7 flag, restaurant running hours (24–120) |
| Customise Time Reports | Named slots (e.g. Breakfast) with from/to (30-min steps) and days (All, Mon–Sun) — feeds "Restaurant Timing Summary" report |
| Online Restaurant Timings | Named online timings + days |
| Other information | Delivery hours (two windows) |
| Dashboard Chart Timing | Named chart slots (hourly) |

## 4. Payment

| Field | Key | Notes |
| --- | --- | --- |
| Currency\* | `currency_format` | ~56 (INR ₹, USD, EUR, GBP, AED, …) |
| Custom Payment Types | `custompaymenttype` | add/enable (`/users/add_custom_ptype`, `/users/change_custom_ptype`, `/users/change_main_ptype`) e.g. Gpay, PayTm, Bhim |
| Payment Card Options | `paymentcardoption` | `/users/add_pcard_option`, `/users/change_payment_card_option` |
| UPI providers | `upioptionval` + custom name | ~34 providers (Amazon Pay, BHIM, CRED, Google Pay, PhonePe…) |

## 5. Invoice Sequence

List of named invoice sequences (multiple numbering series); Active / Inactive / Remove. Endpoints `/users/resinvoice_list/`, `/users/res_invoice/`.

## 6. Floor Plan

Visual table layout designer (drag shapes/tables per floor). Modals: "Use Larger Screen", "No shape Selected", "Discard Floor plan". Endpoints `/users/floor_listing/`, `/users/add_floor_plan/`.

## 7. Display (Billing screen)

Sections: Display settings · Default Values · Payment Options In Billing Screen · Section configuration · Table Settlement · Discount · Order Wise Information · Negative Quantity · Order Cancel · Order Edit · Order Complimentary · Order Sales Return · Lower/Higher settlement amount · Hierarchy Discount OTP · Special Order Discount · Item price change (NC) · KOT Cancel

Key settings:

| Setting | Key |
| --- | --- |
| UI mode | `kb_tb` Keyboard / Touch Screen; compact sidebar; menu left/right |
| Default screen | `default_screen` Billing / Table Management |
| Order & KOT sort | `ord_sort`, `kot_sort` asc/desc |
| New item position | `a_i_c` bottom/top |
| Virtual keyboard | `open_virtual_keyboard`, `v_k_fr`, `o_v_k_o_s_c` |
| Item images | `i_img` default / large |
| Auto add item on select / from popup | `auto_add_item_on_select`, `auto_add_item_from_popup` |
| Addon min–max validation | `addon_min_max_validation` |
| Display item price, settle amount textbox, settlement mandatory, allow lower settlement | `display_item_price`, `settle_amount_textbox`, `m_s_a_m`, `s_l_a` |
| Tips | `showtip`, `tip_v[t_s]` none/percentage/fixed, value, on core/total |
| Category-wise tax display, open tax/discount area by default | `show_cwt_billing_screen`, `open_taxes_billing_screen`, `open_discount_billing_screen` |
| No. of persons mandatory | `show_no_of_person_mandatory` |
| Decimal qty disallowed | `da_d_q` |
| Category scheduling offline | `c_s_c` |
| Suggested items | `i_sg` |
| Item sorting | `itm_s` A-Z / Price / Rank |
| Group-wise virtual outlet menu | `groupwise_virtual_outlet`, default Veg/Non-Veg |
| Open order in edit mode after Save & Print; auto open settlement popup | `p_e_o[...]` |
| Defaults | Order type, payment type, custom payment type, table no., **petty cash\***, item qty, item price, default qty |
| Finalize order | `finalize_order` |
| Payment option buttons 1–4 | `pay_o_1..4` (Not Paid, Cash, Card, Due, Other, UPI, Part, custom) |
| Order type labels & visibility | `delivery_label`, `pickup_label`, `dinein_label`, `show_home/pickup/dinein` |
| Table lock / release | `lock_table_no` (Save & Print / Settle & Save / None), `release_table_on`, `release_recent_section` |
| Discount UI | label, button text, "Leave as it is (No Discount)" |
| Order-wise information | enable + label |
| Negative quantity | allow + reasons |
| Cancel / Edit / Complimentary / Sales return | reasons list + notify email/WhatsApp (`c_o_e_o`, `o_e_o`, `co_e_o`) |
| Hierarchy discount OTP | table: Level · Discount Range (%) · Email · WhatsApp — approver chain |

## 8. Print logo

Upload `print_logo` for desktop POS bill print (`/users/save_pos_configuration/`).

## 9. Calculations

| Section | Settings |
| --- | --- |
| Round-off | Normal / Up / Down / None; increment 1, 0.5, 0.25, 0.1, 0.05; decimal points 1–3 |
| Service Charge | show; label\*; fixed/percentage; on core/total; value; per order type; tax on SC; apply on online; conditional (greater/less than amount); min persons |
| Container (packing) Charge | show; label\*; item-wise / order-wise / fixed per item; fixed/percentage; core/total; per order type; tax on it; conditional amount |
| Delivery Charge | show; default delivery charge\*; tax on it; conditional amount |
| Discount | tax before discount; backward tax after discount; special discount on total/core; auto item/category discount; show discount popup on add; auto BOGO; common coupon; ignore add-on price in discount; special discount reason mandatory |
| KOT/Bill | assign bill sales to KOT user; save KOT on save bill; include non-prepared KOT; merge duplicate items; split bill by group; auto finalize after 30/45/60 days; daily KOT number reset from N |
| Complimentary | disable taxes & charges on complimentary |
| Special Notes | save note into master |
| Surcharge | show; label; fixed/percentage; value; per payment mode (Cash, Card, Due, Other) |
| Tax Validation | Block billing if GST not applied |

## 10. Connected Services

| Section | Settings |
| --- | --- |
| Day End | manual day end; shift end; block if active tables; block if unsynced orders; restrict edit after day end |
| Loyalty | "Send Loyalty" default; per order type; per channel (delivery, pickup, dine-in, own web, QR, online); loyalty on discounted orders; trigger on Print Bill / Settle & Save |
| Cash Drawer | open for cash only |
| KDS | KDS → order screen updates; all items done ⇒ KOT done |
| Captain App | print KOT from captain app; allow discount (dine-in); MFR notification Item Ready / KOT Ready / None |
| e-Invoice | enable e-invoice (GST IRN) |
| Barcode (weighing scale) | prefix, weight char count, denominator; multiple items per barcode with delimiter |
| Expense | restrict back-dated expense/withdrawal |

## 11. Print (Bill & KOT)

| Scope | Settings |
| --- | --- |
| Both | order barcode on bill & KOT (full id / last 4) |
| KOT | print KOT on Print Bill; only modified KOT; only modified items; cancelled KOT; add-ons/notes below item; "Duplicate" on reprint; deleted items (inline / separate KOT); food-ready barcode; print on table move; auto-print at status None/Food Is Ready/Dispatched |
| Bill | None / Category-wise tax / Brand-wise bifurcation; "Duplicate" on reprint; customer paid & change; KOT no. as token; addons; order barcode; merge duplicate items; quantity breakdown (5 + 1); merge e-bill and print; store print on S3 |

## 12. Customer

Phone mandatory per order type; min/max phone length\*; show email; email validation per order type; bill with tax ID (B2B GST); phone mandatory for due payment.

## 13. Online/Advance Order

| Section | Settings |
| --- | --- |
| Auto Acceptance | KOT print after auto-accept; bill print after auto-accept |
| System | ignore online delivery charge; delivery charges (₹); minimum order amount; auto-cancel duration 15–60 min; accept online payment; web orders from online |
| Delivery & preparation time | min prep time, min delivery time |
| Advance Order | reminder (none, 15–180 min); no memo for advance (offline); KOT on memo; manual invoice from memo after settlement; KOT on accepting online advance order; skip offline stock check; min advance amount validation (order amount, fixed/percentage) |
| Custom turn-off time | None / Day(s) / Hour(s) / Minute(s) |

## 14. Billing System

| Section | Settings |
| --- | --- |
| Order & sync | sync batch size (2–80); default order limit\*; auto sync time (5–120+ min); pending-order sync time; captain intranet sync time; minutes allowed to edit orders\*; auto settle after print (min); protocol Secured/Normal; hours allowed to cancel |
| Payment sync | payment request sync time\*, check payment request sync time\*; voice notification for static QR payments (English/Hindi) |
| Display | refresh billing screen after N prints\* |
| Security | default manager password (desktop); idle logout time\*; logs for orders modified after print; logs for updated orders; logs for customer-detail changes after print |

## 15. SMS / Notification

Store daily sales statistics; send daily sales statistics SMS.

---

## Related configuration lists

| Page | Route | Fields / endpoints |
| --- | --- | --- |
| Sub Order Type | `/items/sub_order_type_list/` | Name; Active/Inactive/Delete; `/items/sub_order_typelist/`, `/items/sub_order_type/`, `/items/delete_suborder_type` |
| Delivery Distance | `/items/delivery_distance_list/` | distance slabs; `/items/deliverydistancelist/`, `/items/delivery_distance/` |
| Area/Locality Wise Delivery Charges | `/users/area_wise_delivery_charge_list/` | Status filter; `/users/areawisedeliverychargelist/`, `/users/area_wise_delivery_charge/` |

## Implementation guidance

Store configuration as a **typed settings document per outlet** (JSON with schema + version), grouped by the sections above; expose search across setting labels; support copy-to-outlet; log every change (who/when/before/after) — Petpooja surfaces this as Configuration Logs and Audit Trail.