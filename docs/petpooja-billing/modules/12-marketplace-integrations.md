# Module: Marketplace, Subscriptions & Integrations

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** live view of `/market/services`, server HTML of `/market/settings/`

## Marketplace — `/market/services`

Top tabs: **Services · Integration · Active Subscription**. Each card has "Explore Now" (detail page `/market/{service}_details`) and shows state: *Inactive*, *Activated – N days left*, or "1 Year Free".

### Services

| Section | Products |
| --- | --- |
| POS Plans | Petpooja Growth Plan, Petpooja Scale Plan, POS + Growth, POS + Scale, Marketing Manager Core/Growth/Scale, POS + Marketing Core/Growth/Scale. Banner: "POS Subscription Activated – N days left. Renew your plan today!" |
| Easy Operations | Kitchen Display System (KDS), Smart Stock Manager, Captain Application, SMS Service for Home Deliveries, Self-Order Kiosk, Token Management, Petpooja Scan & Order, Online Order Reconciliation, WhatsApp Alerts, Dynamic Reports, Waiter Calling Device, Digital Display Application, Petpooja GO (one-time / rental), Attendo, Petpooja Tasks, Petpooja Purchase |
| CRM | SMS Service, Gift Card, Feedback Management, Link based Feedback, Virtual Wallet, Petpooja Loyalty, QR Code based Feedback, Reservation Manager App |
| Customer Acquisition | Call Center, My Website |
| Petpooja Loan | Petpooja Loans |

### Integrations

| Section | Partners |
| --- | --- |
| Online Orders | Zomato, Swiggy, Dotpe, Airmenus, uEngage, Petpooja Aggregation – ONDC, Tipplr, Muncho, Paytm (ONDC), Zomato Hyperpure, Ownly, Swish GO, Other Aggregators |
| Order Delivery | uEngage Flash, Shadowfax, Pidge |
| Accounting | Tally, Data Lake, e-Invoice, Zoho Books, Busy Accounting |
| Customer Updates | Green Receipt |
| Loyalty Programs | Bingage, Reelo, eWards, uEngage Prism, CKKA, 1 Loyalty AI, BillFree, Trozo Loyalty, MRP Shop |
| Payments | Razorpay, Bijlipay, Axis Bank |
| Hardware | Posbank, Posiflex, iMin, Ira |

Online-order channel dropdowns list **~600 partner identifiers** (see Online Orders filter), so the integration layer must be **multi-tenant, partner-agnostic** (webhook in, status callbacks out, menu push).

### Product detail pages (linked from mega-menu)

`/market/captain_order_details`, `/market/kds_details`, `/market/own_website_details`, `/market/kiosk_details`, `/market/petpooja_insights_details`, `/market/online_reconciliation_details/`, `/market/petpooja_payroll_details`, `/market/restaurant_loyalty_details`.

### Purchase flow

Detail page → choose plan (e.g. 1 Year) → optional promo code (`/market/verify_marketplace_promocode_apply/`) → pay (Zaakpay: UPI QR / cards / net banking; PhonePe callback) → service activated with expiry. Free services via `/zaakpays/free_service/{service}`.

## Marketplace Settings — `/market/settings/`

Per-service configuration after activation. Endpoints observed (one per service):

`/market/add_captain_data/`, `/market/add_feedback_data/`, `/market/add_feedback_qr_data/`, `/market/add_sms_feedback_data/`, `/market/add_virtual_wallet_data/`, `/market/add_restaurant_loyalty_data/`, `/market/add_reelo_data/`, `/market/add_green_receipt_data/`, `/market/get_online_order_services/`, `/market/add_ebill_expiry_data/`, `/market/get_delivery_chain_services/`, `/market/get_whatsapp_alert_service/`, `/market/add_homedelivery_sms_service_data/`, `/market/add_amazon_s3_integration_data/`, `/market/menu_qr_details/`, `/market/white_label_details/`, `/market/tally_details/`, `/market/digital_display_list/`, `/market/add_device/`.

Digital Display: create display + upload media ("Display Created Successfully", "Upload Media First").

## Aggregator Center

Sidebar group "Aggregator Center" → Swiggy (`/users/helpcenter/2`): partner help centre.

## Implementation guidance

- **Entitlements service:** `{tenant/outlet, product_code, plan, status, starts_at, expires_at, trial, source(purchase|free|admin)}`; every feature checks entitlement; UI shows upsell when inactive.
- **Integration framework:** connector interface (`authorize`, `pushMenu`, `pushItemAvailability`, `pushStoreStatus`, `receiveOrder` webhook, `updateOrderStatus`, `fetchPayouts`) + per-connector settings + request/response logs.