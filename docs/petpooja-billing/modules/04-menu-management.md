# Module: Menu Management (`menu.petpooja.com`)

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** live navigation + server HTML parse of menu sub-app

Menu is a **separate sub-app** on `menu.petpooja.com` sharing the billing session (SSO cookie) and the same layout shell.

## Navigation

| Menu entry | Route |
| --- | --- |
| Menu (common screen) | `/menus/common_screen_menu/` |
| Menu & Discounts (Menu Management home) | `/menus/menu_management` |
| All In One Menu | `/menus/menu_new/all` |
| Schedule Changes | `/menus/menu_new/all/1` |
| Multi-Item Images Upload | `/menus/upload_item_images` |
| Menu on/off (online) | `/menus/item_on_off/` |
| Order Preferences | `/items/special_note_list/item_note/` |
| Set Item Commission | `/items/menucommission_list/` |
| Physical Menu | `/menus/physical_menu/` |
| Add Virtual Outlet (brand) | `/menus/virtual_brand/` |

## 1. Menu Management home — `/menus/menu_management`

Cards: **All In One Menu** (button "Manage Menu") and **Add Virtual Outlet** (button "Add Outlet").

## 2. All In One Menu — `/menus/menu_new/all`

Top tabs: **Items · Categories · Variants · Addons · Tables/Areas · Taxes · Discounts**

Item tab sub-menus (area/price-list menus): **Base Menu · Home Delivery · Parcel · Dine In**. Each area can carry its own price/availability (area-wise menu).

Menu sync to POS: `/menus/sync_menu_request/{restaurant_id}`, status `/menus/menu_sync_status/`, HO sync `/menus/ho_outlet_sync_status/`, `/menus/ho_menu_sync_status/`.

### 2.1 Items grid — `POST /menus/menu_item_list_new`

Left panel: category list ("Hide empty categories" toggle, rank-wise list toggle). Group filter: All / Veg Menu / Non-Veg Menu / Others.

**Filters:** Name, Online Display Name, Shortcode, Item Id, Category, Item type (Items with Variation, with Addon, in Online Order, not in Online Order, Favorite, Combo, with/without Ignore Taxes, with Ignore Discount), Dietary (Veg, Non-Veg, Egg).

**Inline-editable grid columns:** Name\* · Short Code\* · Online Display Name · Category\* (incl. "Add New Category") · Price\* · Description · Available (toggle) · Image · Actions

**Row action shortcuts:** `V+` (variations) · `O` · `D`

**Item flags legend:** O = Expose in online order · V = Item has Variation · A = Addon details · C = Set as combo · F = Favourite · K = Expose in kiosk · D = Available in Dine-in QR

**Bulk:** Select rows → Quick Actions / Apply; "Copy to branch" (HO → outlets); update item price; Add Items (new rows); Save.

### 2.2 Categories — `/items/category_list/`

Sub-tabs: Parent Category · Category · Grouping · Menu Configuration · Tags

Filters: Category name, Group Category (All / Veg Menu / Non-Veg Menu).

Bulk actions: Active, Inactive, Update Expose to online orders, Update Dine-In / Delivery / Pick Up order type, Update Expose to Captain, Update Dine-in QR, Update Timings, Remove Timings, Update Images, Remove Category, Export Category, Import Category (CSV).

Endpoints: `/items/catlist/`, `/items/category/` (add/edit), `/items/update_rank_category/`, `/items/update_timings/`, `/items/fetch_restaurant_areas/`, `/items/update_dinein_areas`, `/menus/change_order_type/`, `/items/expose_remove_category/`, `/items/check_item_exist/`, `/items/check_assign_cwt_grp/`, `/items/category_import_csv/`, `/menus/multiple_category_update_image/`.

### 2.3 Variants — `/items/variation_list/`

Filters: Variation Name, Search By (All, Active, Inactive, Assigned, Not Assigned). Actions: Active, Inactive, Bulk Update, Import, Export.
Endpoints: `/items/varlist/`, `/items/variation/`, `/menus/update_variation/`, `/items/import_variation/`, `POST /items/export_variation/{restaurant_id}`.

### 2.4 Addons — `/items/addon_list/`

Addons are organised as **Addon groups ("Departments") → Addon items**.
Filters: Department Name, Addon Item Name, Search By Department (All, Active, Inactive, Assigned, Not Assigned).
Actions: Active, Inactive, Update in Online, Update in POS, Update in Captain, Remove, Assign Addons, Import Excel (CSV).
Endpoints: `/items/addonlist/`, `/items/addon/`, `/items/addon_detail/`, `/items/addon_zone_price/` (zone/area price), `/items/addon_item_update_areawise/`, `/items/update_addon_group_rank/`, `/menus/update_item_addons_new/`, `/items/upload_addon_group_csv/`, `/items/addon_export_layout/`, `/items/export_import_restricted_addon_data/`, `/ho/get_restaurant_list`.

### 2.5 Tables / Areas — `/menus/res_tables_list/`

Sub-tabs: Tables, Areas. Filters: Table No, Area. Actions: Active, Inactive, Remove, Export/Import Tables.
Endpoints: `/menus/restableslist/`, `/menus/restables/`, `/menus/remove_table`, `/items/table_import_csv/`, `/menus/add_discount_res_areas_tables/`.

### 2.6 Taxes — `/items/tax_list/`, add: `/items/tax/`

**Add Tax form**

| Field | Name | Notes |
| --- | --- | --- |
| Create by | `create_by` | GST Slab (India) · VAT (global) · Other custom taxes (Cess, Corporate…) |
| GST slab | `gst_slab` | GST 5%, GST 18%, GST 40%, IGST (auto-splits into CGST + SGST) |
| IGST % / VAT % | `igst_tax_am`, `vat_tax_am` | |
| Suffix | `suffix` | appended to title |
| Tax type | `tax_type` | Forward · Backward (inclusive) · Calculate on Tax (tax-on-tax) |
| Title\* | `title` | shown on POS, bill print, reports |
| Online Display Name | `online_display_name` | |
| Areas | `areas[]` | per menu area (Home Delivery, …) |
| Select taxes | `select_taxes[]` | for tax-on-tax |
| Type | `type` | Percentage / Fixed |
| Amount\* | `price` | |
| Order types | `order_type[1..3]` | Delivery / Pick Up / Dine In |
| Status | `status` | Active / Inactive |
| Consider in core amount | `consider_in_core_amount` | |
| Do not remove tax | `not_remove_tax` | |
| CGST/SGST SAP code | `sap_code`, `sap_code1` | ERP mapping |
| Description | `description` | |
| No GST on POS | `no_gst_pos` | |

Item-category assignment via "Copy Selection From" modal. Endpoints: `/items/tlist/`, `/items/tax_view_load_ajax/`, `/items/get_rest_categories_item_tax/`, `/items/get_category_items/`, `/items/backward_tax/`, `/items/cess_tax/`, `/items/tax_setting/`, `/items/copy_tax_to_outlet/`, `/items/area_to_area_copy_tax/`, `/items/export_item_tax/`, `/items/export_consolidated_tax_layout/`, `/items/delete_tax`, `/menus/itemwise_tax_details/`, `/items/reset_bill_no/`, "Push Tax to Outlet" modal.

### 2.7 Discounts — `/items/discount_list/`, add: `/items/discount/`

**Add Discount form**

| Field | Name | Options / notes |
| --- | --- | --- |
| Title\* | `title` | |
| Discount on\* | `discount_on` | Point Of Sale, Online Platform, Zomato, Kiosk, Google Pay, OS Aggregator, Mr Divert, IRCTC |
| Allow run-time change | `allow_run_time_change_gpay`, `allow_run_time_change` | |
| Restaurant list\* | `mapped_res_ids_rest[id]` | multi-outlet (HO) selection |
| Order Type\* | `order_type[1..3]` | Delivery / Pick Up / Dine In |
| Discount type | `type` | **Percentage · Fixed · BOGO · DISH · Flat Rate · BXGY · FREEBIE · Fixed Price** |
| IRCTC type | `irctc_type` | Amount / Payment Type |
| Amount (%)\* | `price` | |
| Max discount cap | `max_allowed_discount` | |
| Apply on | `core_or_total` | Core (subtotal) / Total |
| Applicable on (buy side) | `applicable_on` | All / Categories / Items |
| Applicable on (get side) | `get_applicable_on` | All / Categories / Items |
| Buy count / Free count\* | `buy_count`, `free_count` | BOGO / BXGY |
| Freebie item, min amount, qty | `freebie_item`, `freebie_min_amount`, `freebie_limit_count` (1–3) | FREEBIE |
| Order total range | `lower_limit_total` (>=), `upper_limit_total` (<=) | |
| Item-amount discount | `i_am_d`, `i_am_d_l_a`, `i_am_d_p_t` (lower/higher price), `i_am_d_o` (occurrence) | |
| BOGO type / amount | `bogo_type` (Percentage/Fixed), `bogo_price` | |
| BOGO get price order | `bogo_get_price_order` | Lower price / Higher price / Same items only |
| BOGO buy price order / amount | `bogo_buy_price_order`, `bogo_buy_item_discount` | |
| Validity | `from_date`, `to_date`, `from_time`, `to_time` (30-min steps) | |
| Days\* | `days_all`, `days_selection[0..6]` | All days / Sun–Sat |
| Deal type | `deal_type` | Without code w/o validation · With code w/o validation · Assign coupon |
| First order only | `first_order_only` | |
| Status | `status` | |
| Description, Terms & Conditions | `description`, `terms_conditions`, `terms_content` | |
| Import/Export item sheet | `import_item_sheet` | Excel |

List actions: Active, Inactive, Delete, **Push to Outlets** (type "confirm" to proceed), copy progress tracking.
Endpoints: `/items/dlist/`, `/items/discount_detail/`, `/items/get_rest_categories/`, `/items/get_rest_categories_item/`, `/items/get_rest_categories_bogo/`, `/items/get_rest_categories_item_bogo/`, `/items/get_discounts/`, `/items/get_os_outlets/`, `/items/get_irctc_outlets/`, `/items/copy_discount_to_outlet/`, `/items/copy_discount`, `/items/discount_copy_progress/`, `/items/discount_trigger/`, `/ho/copy_online_discount`, `/ho/push_online_discount`, `/items/export_discount_item_sheet/{1|2}`.

## 3. Multi-Item Images Upload — `/menus/upload_item_images`

Wizard: **Module** (Item / Category / Addons) → **Choose where to upload** (Platform or Brand) → select platforms (e.g. Swiggy, Zomato, Kiosk, Talabat, Logo) → verify items → add images (`item_imgs` multi-file) → Submit. "Download Item(s) List" helper.

## 4. Menu on/off — `/menus/item_on_off/`

Sub-pages: Online Menu on/off · Online Addon on/off · Online Variation on/off. Button: **Push Changes (auto in 5 minutes)**. Requires an online integration (shows "No online order integration(s) found" otherwise).

| Modal | Fields |
| --- | --- |
| Store on/off Status | Open/Close for Delivery; until date/time or 30 min / 1 h / 2 h / Custom; reason: High order rush/Kitchen full, Raw material out of stock, Kitchen staff not available, Nearing closing time, Outlet timings incorrect, Temporarily closed, Issues with menu, Other (text); "Update all stores" |
| Logistics Details | Open/Close for Self Delivery; revert after N seconds; reason |
| Make Items Unavailable | 2 h / 4 h / 8 h / 24 h / Indefinite / Next Business Day / Custom (date + hh:mm) |

## 5. Order Preferences — `/items/special_note_list/item_note/`

Tabs: **Item Notes · Cooking Preferences · Order Notes · Allergens**. Filter by name; Available / Not Available / Remove; drag rank; import.
Endpoints: `/items/spnote_list/`, `/items/specialnote/`, `/items/special_note_detail/`, `/items/update_rank_order_preference/`, `/items/remove_note/{restaurant_id}/{preference_slug}`, `/export_importmenu/import_item_special_notes/`.

## 6. Set Item Commission — `/items/menucommission_list/`

Tabs: Item Commission · Addon Item Commission. Filters: Category (multi), Item, Commission Type (All, Not Configured, Percentage, Fixed). Modal "Set Menu Commission": None / Percentage / Fixed + value. Import.
Endpoints: `/items/menucommlist/`, `/items/menucommission/`, `/menus/update_item_commission/`. Feeds the "Commission Summary: Assignee Wise" report.

## 7. Physical Menu — `/menus/physical_menu/`

Upload/delete scanned menu files (`physical_menu_files[]`).

## 8. Virtual Brand / Outlet — `/menus/virtual_brand/`

Create a virtual brand (cloud-kitchen style) from a subset of the menu: Name\*, Logo, Bill print header/footer, Status, select categories (all/some), select addons.

## Inferred entities

`Category` (parent, group veg/non-veg, timings, order-type exposure, images, rank, tags), `Item` (name, short_code, online_display_name, category, price per area, description, dietary, flags O/V/A/C/F/K/D, image, ignore_tax, ignore_discount, sap_code, hsn), `Variation`, `AddonGroup` + `AddonItem` (zone price), `Area` + `Table`, `Tax` (GST/VAT/custom, forward/backward/tax-on-tax), `Discount`, `SpecialNote` (type: item_note/cooking/order/allergen), `Commission`, `VirtualBrand`.