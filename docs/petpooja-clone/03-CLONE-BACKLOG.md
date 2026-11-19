# Clone backlog (start only when you ask for development)

Ordered waves. Each wave must ship **Petpooja-like UI** ([01-UI-FIDELITY.md](./01-UI-FIDELITY.md)), not a temporary alternate design.

## Wave 0 — Shell + auth (foundation)

- Sign-in page matching Petpooja layout language  
- Session, logout, 2FA toggle on Edit Profile  
- Sticky header + expandable sidebar with **full nav tree** (links may go to "Shell only" placeholders)  
- Explore Products mega-menu structure, AI Agent drawer chrome, Need Help, device mapping modal chrome  
- Design tokens / Bootstrap 5 base matching observed stack  

**Exit:** every nav leaf is reachable; most bodies can be placeholders that still look like Petpooja empty states.

## Wave 1 — Dashboard parity

- All dashboard widgets, date presets, Highcharts channel chart, Action Center modals, Daily Snapshot, upsell cards  
- Spec: `petpooja-billing/02-dashboard.md`  

**Exit:** side-by-side dashboard with Petpooja passes fidelity checklist.

## Wave 2 — Orders daily operations

- Live Orders, All Orders (full filters + actions), Online Orders lifecycle UI, KOT, Day End, Delivery Management  
- Spec: `modules/03-orders-billing.md`  
- Backend: order model, statuses, OTP remove, day-end  

## Wave 3 — Outlet configuration

- Hub + all 15 settings pages + sub-order type / delivery distance / area charges / floor plan  
- Spec: `modules/07-outlet-configuration.md`  
- Typed settings document that drives later POS behaviour  

## Wave 4 — Menu sub-app

- Host or path that feels like `menu.petpooja.com`  
- All In One Menu tabs, taxes, discounts (full form types), on/off, images, commission, virtual brand  
- Spec: `modules/04-menu-management.md`  
- Capture remaining add/edit popups during build if still unknown  

## Wave 5 — Users, devices, logs

- Biller users, device mapping, apps page, all log pages, Audit Trail SPA shell  
- Spec: `09`, `10`  

## Wave 6 — Accounting & payments

- Payout tracker, wallet, reconciliation, GST, bank, expenses, service history, loans, denomination  
- Spec: `08`  

## Wave 7 — Reports platform

- Report catalogue UI + runner + notifications + Day End already in Wave 2  
- Spec: `06` — implement registry; open each report's filters during build to close gaps  

## Wave 8 — CRM + Marketplace

- Customers (mask/unlock), campaigns, feedback, loyalty purchase flow UI, Marketplace services/integrations/settings  
- Spec: `11`, `12`  

## Wave 9 — Inventory sub-app

- Full inventory nav and settings  
- Spec: `05`  

## Wave 10 — Finance SPA

- Match `finance.petpooja.com` routes and Leakage Watch  
- Spec: `13`  

## Wave 11 — Marketing Automation + Dynamic Dashboard

- Requires deeper capture ([04-GAP-CAPTURE.md](./04-GAP-CAPTURE.md))  
- Until then: Petpooja-like marketing/landing + gated app shells  

## Wave 12 — Ecosystem apps + POS client

- Captain, KDS, kiosk, website, Attendo, Tasks, TRM, Purchase, Bazaar  
- Offline-first POS billing screen matching Petpooja POS behaviour driven by Wave 3 settings  

## Parallel / continuous

- Entitlements service (Marketplace)  
- Connector framework for aggregators  
- Audit event pipeline  
- Screenshot regression vs Petpooja for finished screens  
- Fill gaps in `petpooja-billing` when popups/reports are opened  

## Suggested first ask when you start development

> "Start Wave 0 and Wave 1 from `docs/petpooja-clone/03-CLONE-BACKLOG.md`. Match Petpooja UI per `01-UI-FIDELITY.md`. Do not continue the REA Counter MVP UI."