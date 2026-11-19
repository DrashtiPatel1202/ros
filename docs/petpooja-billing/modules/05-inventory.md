# Module: Inventory (`inventory.petpooja.com`)

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** live navigation + server HTML parse (approved by user)

Separate sub-app sharing session. Settings scoped per restaurant (`RestId`).

## Navigation

| Group | Entry | Route |
| --- | --- | --- |
| Dashboard | Inventory Dashboard (new) | `/inventory_dashboard/new_inventory_dashboard/` |
| | Legacy dashboard | `/inventories/inventory_dashboard/` |
| Transactions | Stock Purchase | `/inventories/purchase_list/` |
| | Purchase Order | `/inventories/purchase_order_list/` |
| | Purchase Return | `/inventories/purchase_return_list/` |
| | Available Stock | `/inventories/new_available_stock/` |
| | Closing Stock | `/inventories/new_manual_stock/` |
| | Sales (to other outlets/parties) | `/inventories/sales_list/` |
| | Transfer | `/inventories/rm_transfer_list/` |
| | Wastage | `/inventories/wastage_list/` |
| | Sales Return | `/inventories/sales_return_list/` |
| Production | Production Master | `/inventory_conversion/raw_material_conversion_list/` |
| | Production Execution | `/inventory_conversion/convert_to_production_list/` |
| | Barcode Generation | `/inventory_barcode/barcode_generation/` |
| Reports | Current Stock | `/inventories/new_item_stock_list/` |
| | Stock Summary | `/inventories/daily_report/` |
| | Orderwise Consumption | `/inventory_reports/consumption_report/` |
| | Other Reports | `/inventory_reports/other_reports/` |
| Masters | Raw Materials | `/inventories/rm_list/all` |
| | Item Recipes | `/inventories/inv_recipe_list/` |
| | Suppliers / Third Party | `/inventories/supplier_management/` |
| | Purchase Bill Payments | `/inventories/purchase_payment_list/` |
| | Invoice Templates | `/inventories/inv_invoice_design` |
| | Units | `/inventories/unit_list/all` |
| Settings | Inventory Settings | `/inventories/inventoy_setting/` |
| | Email Template Setting | `/inventories/email_template_setting/` |

## Dashboard widgets

Daily Stock closing tracker (update accuracy %), Current Inventory value (₹), COGS Breakdown, Purchase Insights, Pending Tasks (pending POs). CTA "Update Today's closing".

## Document types (shared list pattern)

All transaction lists share: date range, counter-party type (**Supplier / Restaurant / Kitchen**) with dependent pickers, document number, Payment (All, Unpaid, Paid, Partially Paid), Status (All, Saved, Sent & Email, Processed, Cancelled, [Rejected]), Type (Internal Transfer, Manual Stock), To Department. Actions: Search, Clear, More Filters, Export Current Page, Export All.

| Document | Number field | Direction |
| --- | --- | --- |
| Purchase (GRN/invoice) | Invoice No. | From supplier/restaurant/kitchen → this outlet |
| Purchase Order | PO Number | This outlet → supplier/… |
| Purchase Return | Debit Note No. | This outlet → supplier |
| Sales | Invoice No. | This outlet → party (department) |
| Transfer | Challan No. | Outlet ↔ outlet/kitchen |
| Sales Return | Invoice No. | Party → this outlet |
| Wastage | — | Status: Saved, Cancelled, Pending For Approval; View: Date wise / Category wise; Export PDF |

## Stock counts

**Available Stock** and **Closing Stock** pages: tabs "Add … Stock" / "Import via Excel" (5-step guided import). Grid: Raw material · Category · Current/Closing · New stock · Difference · Status · Comments. Frequency filter (Daily, Weekly, Bi-Weekly, Monthly, Yearly). Closing Stock adds **Freeze Stock**. Exports to Excel/PDF.

## Production

- **Production Master:** define conversion recipes (raw → semi-finished). Production as per Requirement / Received PO; Raw-material-wise or PO-wise; "Generate production Plan", "Convert to Production", copy, bulk delete, import/export.
- **Production Execution:** Direct Production / Production against PO, per restaurant/category; export PDF/Excel.

## Masters

| Master | Fields / actions |
| --- | --- |
| Raw Materials | Name, Category, Sub Category; Active/Inactive, Favorite, Delete, deleted logs, Import/Export |
| Item Recipes | Map menu item → raw material quantities; filters item/category/created vs pending recipes; **Auto Consumption** toggle; Explore Recipes, Recipe Customizer, Area Recipe, Bulk recipe editor, Replicate, Copy recipe (outlet ↔ HO), Import/Export |
| Suppliers / Third Party | Name, Company; Active/Inactive/Delete; Import |
| Purchase Bill Payments | Bulk settle supplier bills by party + date |
| Units | Display name list |
| Invoice Templates | Design purchase/sales invoice PDF |

## Reports

| Report | Filters |
| --- | --- |
| Current Stock | Raw material, Category (multi), Sub-category, Stock Level (At-par, Minimum, Negative, Maximum), Status (Up to date, Lack of action); configurable columns (avg price, SAP code, HSN, consumption-unit stock, total avg purchase price) |
| Stock Summary | Raw material, category, unit type (Purchase / Consumption), date range; Excel + PDF |
| Orderwise Consumption | Order no., raw material, dates, Order type (Orders / Production Execution) |

## Settings (`/inventories/inventoy_setting/`)

Tabs: Consumption & production · Purchase Order · Stock Purchase · Sales & Transfer · Settings for both sales & purchase · Closing related · Other · Configuration Logs (before/after audit).

| Setting key | Meaning |
| --- | --- |
| `inventory_auto_consumption` | Deduct raw materials automatically on sale (via recipe) |
| `inventory_notification` | Stock notifications |
| `inventory_item_stock_status` | Auto item on/off from stock |
| `inventory_atpar_notification_kitchen` | At-par alerts to kitchen |
| `inventory_stock_revert` | Revert stock on cancel |
| `inventory_po_tax_enable` | Taxes on PO |
| `allow_ship_bill_to` | Ship-to/bill-to on PO |
| `inventory_allow_raw_material_min_qty` | Min qty enforcement |
| `enable_standard_terms_of_payment_delivery` + `inventory_standard_po_term_payment/delivery` | PO T&C text |
| `inventory_restrict_po_generation_backdate_currentdate_config` | None / Today / Future / Past 60 days; `days_allowed_backdated_po` |
| `purchase_invoice_label`, `sales_invoice_label`, `transfer_invoice_label` | Document titles |
| `inventory_stock_avg_price` | Weighted average costing |
| `inventory_sale_term_condition` | Sales T&C |
| `inventory_round_off_bills` + increment | Normal / None / Up / Down; 1, 0.5, 0.25, 0.05 |
| `is_cess_tax_enabled`, `cess_tax_percentage` | Cess |
| `inventory_favorite_supplier_flow` | Select RM one-by-one vs show all mapped |
| `inventory_container_weight_enable` | Tare/container weight |
| Pre-configured reasons | For purchase/sales returns and wastage |
| Daily outlet closing time | For stock day boundary (timezone shown) |
| Copy settings to another outlet | Modal |

**Email Template Setting:** header logo, header colour, outlet address footer, default CC / BCC.

## Inferred entities

`RawMaterial` (category, sub_category, purchase_unit, consumption_unit, conversion, min/max/at-par levels, avg_price, sap_code, hsn), `Recipe` (item → [raw_material, qty], area-specific), `Supplier`, `InventoryDocument` (type, number, party_type, party_id, status, payment_flag, lines[]), `StockSnapshot` (date, rm, qty, type available/closing), `ProductionPlan`, `Unit`.