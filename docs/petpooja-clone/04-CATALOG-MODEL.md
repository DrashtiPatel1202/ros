# Catalog model

Petpooja stores taxes, discounts, variations and addons as separate lists under the menu sub-app, then assigns them to items. The clone keeps that split so one outlet can grow to thousands of items without a single settings document.

| Table | Role |
| --- | --- |
| `menu_categories`, `menu_items` | What the POS punches. Availability is a flag, not a delete. |
| `menu_taxes` | GST, VAT or custom. One active row per outlet is the default bill tax. Rate is basis points. |
| `item_taxes` | Optional. No rows means the item uses the outlet default. |
| `menu_discounts` | Offers. Percentage and fixed apply on the bill today. BOGO, BXGY, freebie, flat rate, dish and fixed price are allowed in the table so those forms can be added without a migration. |

Money stays in paise. Every catalog row is scoped by `outlet_id` and indexed for the active list. Changing an item bumps `outlets.menu_version`, which is the cache key for the counter menu.

Billing routes share one session check (`billingAuth.ts`) instead of a cookie parser per module.
