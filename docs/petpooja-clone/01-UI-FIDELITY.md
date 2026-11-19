# UI fidelity rules (clone = same UI)

**Observed:** 2026-11-19 on `billing.petpooja.com/users/dashboard` (logged-in demo).  
**Intent:** agents recreate the **same visual and interaction language**, not a "modern redesign".

## Hard rules

1. **Mirror the shell first.** Header + left sidebar + `#content` main column must match Petpooja's information architecture before any widget polish.  
2. **No new design system.** Prefer Bootstrap 5 patterns Petpooja already uses (`btstrp5.min.*.css`), InterVariable, light grey page background, sticky light navbar.  
3. **Same page anatomy.** Breadcrumbs, page title, filter row, primary actions, table/grid, pagination/export, fancybox-style modals.  
4. **Same empty / upsell / error copy structure.** When Petpooja shows "No online order integration(s) found" or marketplace CTAs, the clone shows the same pattern (rewrite brand names only if white-labelling).  
5. **Side-by-side acceptance.** For each finished screen, open Petpooja and the clone at the same viewport width and check density, control order, and chrome.  
6. **Do not replace lists with "cards-only dashboards"** unless Petpooja itself does that on that page.  
7. **Desktop-first.** Petpooja billing is a dense desktop back-office; keep that density. Responsive collapse is secondary and should follow Petpooja, not mobile-first redesign.

## Observed chrome (dashboard)

| Layer | Observed classes / facts |
| --- | --- |
| `body` | `sidebar-open nav_sidebar has-agent-fab dashboard-page` |
| Header | `ps-header ps-header-new navbar navbar-expand-md sticky-top navbar-light bg-light menu-div` |
| Sidebar | `sidebar sidebar-menu sidebar-new-ps` |
| Main | `#content` |
| Background | `rgb(250, 250, 250)` |
| Text | `InterVariable, -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif` |
| CDN CSS (examples) | `billingcdn.petpooja.com/css/btstrp5.min.*.css`, `fanJqbx566.*.css` (fancybox), `sass/card.*.css`, `sass/button.*.css`, multiple app CSS bundles |
| Charts | Highcharts (Column / Area / Line selector on dashboard) |
| Modals | Fancybox / `.ps-fancybox` / `.new-fancybox-wrapper` patterns |
| Product version | Profile menu shows `Version - 129.0.1` |

## Global shell checklist (every authenticated page)

Reproduce these **exactly in placement and purpose** (labels can stay Petpooja-like unless white-labelling):

### Top bar

- Outlet / restaurant switcher (name + brands count)  
- Notifications bell with count  
- **Explore Products** mega-menu  
- **AI Agent** launcher (FAB / drawer with suggested prompts)  
- Profile avatar menu: Edit Profile, Petpooja Apps, Terms, Privacy, Logout  

### Product switcher (observed list items)

Bazaar · Reconciliation · Insights · Marketplace · Orders · Suppliers · Menu · Inventory · Reports  

### Left sidebar groups (must exist)

Use [route-map](../petpooja-billing/reference/route-map.md) as the source of truth. Groups include:

- Dashboard / Dynamic Dashboard (New)  
- Daily Operations (Live Orders, All Orders, Online Orders, Dynamic Reports, KOT)  
- Menu (→ menu host)  
- Inventory  
- Marketing Automation (New)  
- Finance (New)  
- Reports (Day End, Other Reports, Report Notification, Delivery Management)  
- Management → Configuration / Accounting / User Management / User Logs / Explore Products / Audit Trail / Device Mapping  
- CRM  
- Aggregator Center  
- Quick Links  

### Recurring chrome

- Quick Links pin area  
- Need Help / support WhatsApp / call-back patterns  
- Device mapping modal (mapping code / sync code)  
- Action Center drawer (dashboard)  

## Page-type templates (clone these patterns)

### A. Filterable list page (All Orders, KOT, wallets, logs, …)

1. Breadcrumb  
2. Title + primary buttons (Search, Show All, Export, destructive actions)  
3. Filter form (`data[Model][…]` field groupings → your form, same labels/order)  
4. "More Filters" expansion where Petpooja has it  
5. Result table / AJAX grid  
6. Row actions (view / edit / cancel / …) opening detail modal or page  

### B. Card hub (Outlet Configuration, Menu Management home, Marketplace)

Grid of cards with title, short description, CTA ("Manage", "Explore Now").

### C. Multi-tab master (All In One Menu, Expense Management, Service Payment History)

Top tabs switch grids; keep tab labels and order.

### D. Settings form (Outlet config pages)

Section headings, toggles, select lists, Save — match field order from `modules/07-outlet-configuration.md`.

### E. Dashboard widget page

Independent widgets with date presets, Highcharts, retry empty/error states, upsell cards.

## Visual tokens to recreate

Document concrete tokens in implementation as CSS variables, seeded from live computed styles:

| Token | Observed direction |
| --- | --- |
| Page bg | `#fafafa` |
| Header | light navbar, sticky |
| Accent / links | Petpooja teal/green family used in CTAs and active nav (sample from live; do not invent purple AI themes) |
| Cards | light surfaces, soft borders (existing `sass/card` language) |
| Buttons | Petpooja button CSS language (`sass/button`) |
| Density | compact tables, small form controls |

**Forbidden for this clone:** redesigning into the REA Counter cream/Fraunces look, Inter-only marketing landing aesthetics, or purple gradient "AI SaaS" skins.

## Interaction fidelity

- Fancybox / modal overlays for add-edit, not full-page forms unless Petpooja uses a full page  
- OTP / password step-up dialogs for destructive actions  
- Export Current Page / Export All  
- Date presets: Today / Yesterday / Last 7 / Last 30 / This Month / Last Month / Custom  
- Toasts / flash messages in Petpooja's style  

## Asset policy

| Asset | Clone rule |
| --- | --- |
| Layout, class structure inspiration, control order | Required |
| Petpooja logo / illustrations / CDN images | Replace with your licensed assets **in the same slots**, or use placeholders of identical size |
| Exact minified Petpooja CSS files from CDN | Prefer re-implementing equivalent styles; do not hotlink their CDN in production |
| Highcharts | Allowed as a library; match chart types and series toggles |

## Acceptance checklist per screen

- [ ] URL or nav path matches route-map intent  
- [ ] Shell identical (header + sidebar + content)  
- [ ] Filters / columns / actions match module doc  
- [ ] Empty, loading, and error states exist  
- [ ] Side-by-side screenshot attached in PR description  
- [ ] Gap file updated if Petpooja has something still unknown