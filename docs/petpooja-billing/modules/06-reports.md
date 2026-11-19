# Module: Reports

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** server HTML parse of `/custom_reports/rlist/0` (report catalogue) and report pages

## Entry points

| Page | Route | Purpose |
| --- | --- | --- |
| Reports catalogue ("Other Reports") | `/custom_reports/reports/` → list `/custom_reports/rlist/0` | 100 predefined reports in 7 categories + Favourites |
| Report Notification | `/custom_reports/report_notifications/` | Schedule reports by email/WhatsApp; list `/custom_reports/report_noti/`, add `/custom_reports/add_report_notification/`; Active/Inactive |
| Day End Summary | `/orders/day_end_summary/` | See [orders](./03-orders-billing.md#5-day-end-summary--ordersday_end_summary) |
| Dynamic Reports (Insights) | `/users/data_analytics` → token handoff `/users/get_token_with_url/` | Embedded BI (separate product, marketplace "Dynamic Reports") |
| Dynamic Dashboard | `/users/ai_report_redirect` → `dashboard.petpooja.com` (separate login) | AI dashboard product |

Each report card supports: **View Details**, mark **Favourite**, run with filters (date range, outlet(s), etc.), export (Excel/PDF). Tab 1 ("All Restaurant Report") reports aggregate across all outlets of a chain/HO.

## Report catalogue

### 1. All Restaurant Report — *insights across all outlets*

| Report | Description |
| --- | --- |
| All Restaurant Sales Report | Total sales of all your restaurants |
| Outlet-Item Wise Report (Row) | Consolidated item sales with outlets in row format |
| Invoice Report: All Restaurants | Total invoices of all restaurants |
| Pax Sales Report: Biller Wise | Sales per pax by each biller |
| Order Report: Sub-Order Wise | Orders bifurcated by sub-order type |
| All Restaurant Report: Day Wise | Total sales per day |
| Order Summary: Corporate Customers | Corporate customers with GST |
| Cancel Order Report: All Restaurants | Qty and cost of cancelled orders |
| Discount Report | All discounts on online and offline orders |
| All Restaurants Sales: Hourly Item Wise | Hourly sales |
| Category Wise Report: All Restaurants | Sales per category |
| Orders Master Report: All Restaurants | Orders with customer info and charges per bill |
| Order Report: Item Wise All Restaurants | Item-wise orders with customer info and charges |
| Cancel Order Report: Item Wise All Restaurants | Item-wise cancelled bills |
| Locality Wise Report: All Restaurants | Orders grouped by locality |
| Item Report: Invoice Details | Items sold per group |
| Item Wise Report: All Restaurants | Sales per item |
| Item Wise Report (Brand wise): All Restaurants | Item sales by brand |
| Online Order Report: All Restaurants | Online order details and activity |
| Discounted Orders: All Restaurants (With Reason) | Discounted orders with reason |
| Tag Wise Report: All Restaurants | Sales per tag |
| Advance Order Summary Report | Advance orders with customer info |

### 2. Order Related Reports — *order details & growth*

| Report | Description |
| --- | --- |
| POS Collection Report | Payments, taxes and category sales |
| Growth Report: Day Wise | Day-wise orders & expenses + monthly/yearly growth |
| Orders: Master Report | Orders with customer info & charges |
| Order Print Count Report | Re-prints of the same bill |
| Order Report: Payment Wise | Payment details per order |
| Order Report: All Order Types | Online vs dine-in bifurcation |
| Sales Report: Billing Counter Wise | Sales per billing terminal |
| Bill Settlement Report | Settlement status, time, payment type |
| GSTIN IRN Report | IRN generated for GST e-invoice |
| Advance Order Master Report | Advance orders master |
| Complimentary Order Report | Complimentary orders with reason, customer |
| Executive Sales Report | Short breakdown of sales & advance bookings |

### 3. Item Related Reports — *menu insights*

| Report | Description |
| --- | --- |
| Tax Report: Item Wise | Tax of all sold items |
| Item Wise: Sales Report | Sales per item in period |
| Highest Selling Items Report | Top sellers |
| Item Sale Report: Hourly Wise | Hourly item sales |
| Item Wise Report With Bill No. | Item sales with invoice |
| Addon: Item Wise Report | Add-ons sold per item |
| Non-Chargeable Item Report | Items whose price changed before billing (NC) |
| Item Report: Day Wise | Day-wise item summary |
| Item Invoice Report: Negative Quantity | Non-served items with negative invoice |
| KOT Report: Negative Quantity | Negative KOT summary |
| Variation Report | Sales grouped by variation |
| Item Report With Customer/Order Details | Items with customer & order |
| Employee Performance | Items served by each employee |
| Commission Summary: Assignee Wise | Commission per assignee |
| Item Report: Group Wise | Group-wise sales, discount & tax |
| Addon Report | Add-ons used per bill item |
| Order Audit: Item Wise | Items modified with staff name |
| KOT Itemwise Process Time Report | Kitchen prep time (KOT punch → settled) |
| Item Report: Brand Wise | Brand-wise sales, discount & tax |
| HSN Report | HSN-wise bifurcation |
| Item Performance Report | Item performance on online channels |
| Item Price Report: Area Wise | Area-wise item prices |
| Item Wise: Addon Report | Items in which add-ons were added |
| West Bengal Excise Report | TXT export for WB Excise |

### 4. Category Related Reports

Sales Report: Category Wise · Sales Report: Group Wise · Group Wise Report: Per Day Wise · Tax Bifurcation: Category Wise · Tax Bifurcation: Group Wise · Sales Report: Brand Wise · Brand Wise Report: Per Day Wise · Tax Bifurcation: Brand Wise · Sales Report: Tag Wise

### 5. Customer Related Reports

Total Customer Spend Report (total spend per customer) · Customer Spend Report: Per Invoice (avg per person per invoice)

### 6. Discount Related Reports

Total Coupon Report · Discount Coupon Consumption Report · Auto Discount Report · Bogo Discount Report · Discounted Orders: Outlet Wise (With Reason) · Orderwise Co-funded discount summary (merchant vs aggregator share)

### 7. Others Reports

| Report | Description |
| --- | --- |
| Sales Report: Online Platforms | Sales per online platform |
| Captain Performance Report | Sales per captain (Captain App) |
| Locality Wise Report: Single Outlet | Orders by locality |
| Sales Report: Call Center Agent Wise | Online sales per call-centre agent |
| Due Payment Report | Amount due per customer |
| Restaurant Timing Summary | Sales by restaurant timing slots (breakfast/lunch/dinner) |
| Virtual Wallet Report | Wallet transactions |
| Petpooja Loyalty Report | Loyalty transactions |
| Sales Report: Biller Wise | Sales per biller |
| Waiter/Delivery Boy Performance | Orders served/delivered |
| Online Order Activity Report | Stage-by-stage online order activity |
| Received Due Payment report | Payments received against due |
| Gift Card Transaction Report | Gift card transactions |
| Tip Summary | Tips received |

## Implementation guidance

- Model reports as a **registry**: `{ id, category, name, description, filters[], columns[], aggregation, scope: outlet|all_outlets, exports: [xlsx, pdf, txt] }`.
- Reports depend on dimensions present in the order model: order type, sub-order type, biller, captain, waiter, delivery boy, call-centre agent, area, table, category, group, brand, tag, variation, addon, HSN, tax, discount, coupon, payment type, locality, timing slot, customer, GSTIN/IRN.
- Report Notification = scheduled job (daily/weekly) rendering a report to email/WhatsApp.

## Open questions

- Per-report filter forms and column sets were not opened individually (load on "View Details").