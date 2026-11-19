# Module: CRM, Marketing, Feedback & Loyalty

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** server HTML parse; Marketing Automation landing page (account not subscribed)

Legacy CRM pages carry a banner "… has moved to Marketing Automation" (new product at `marketing.petpooja.com`).

## 1. Marketing (legacy CRM dashboard) — `/crm/crm_dashboard/`

Buttons: Add Channel, Create segment, Create campaign, Lock/Unlock (password to unmask customer phone numbers).
Modals: Save Campaign (confirm), Unlock (password).
Endpoints: `/crm/crmdashboard/`, `/crm/add_segment/`, `/crm/view_segment_detail/`, `/crm/change_segment_status/`, `/crm/delete_segment/`, `/crm/refresh_segment/`, `/crm/create_campaign/`, `/crm/save_campaign/`, `/crm/test_campaign/`, `/app/campaign_credit_count/`, `/users/customer_unlock/`, `/users/update_session_unmask_phoneno`.

## 2. Campaigns — `/users/send_sms_history/`

Tabs: **Campaigns · SMS Balance · WhatsApp Balance**

| Filter | Options |
| --- | --- |
| Schedule From / To | dates |
| Campaign Type | Schedule, On Bill Print, Link Based Feedback, Birthday, Anniversary, Home Delivery Order Acceptance, Home Delivery Order Dispatch, eBill, Loyalty Send OTP, Loyalty Redemption, Loyalty Credit, Revert Loyalty, Virtual Wallet Send OTP / Redemption (Card) / Credit / Return to Customer OTP / Return Total Balance / Redemption / Activate Card, … (~24) |
| Channel | SMS, WhatsApp |
| Campaign Name | text |
| Status | Pending, Cancelled, Delivered |

Endpoints: `/users/smshistory/`, `/users/create_sms_campaign/`, `/users/add_sms_campaign/`, `/users/cancel_campaign/`, `/users/sms_detail/`, `/users/reschedule_campaign/`, `/users/reschedule_detail`, `/users/activate_campaign/`.

Insight: campaign types double as the **transactional message catalogue** (e-bill, OTPs, order status, wallet/loyalty notices).

## 3. Customers — `/users/customer_list/`

Tabs: Customers · Customer Tags. Charts: Last 7 Days Orders / New Customers.

| Filter | Options |
| --- | --- |
| Date range | |
| From Where (source) | POS, CRM, Import, Feedback, WhatsApp, Web Order, Customer Enrichment |
| Phone / Name | |
| DND | Yes / No |
| CRM eligibility | Eligible / Non eligible for campaign |
| Tags | Student, Family, Corporate, Anniversary, Repeated Customer (custom) |

Phone numbers are **masked** until Unlock (password). Endpoints: `/users/clist/`, `/users/customer/`, `/users/customer_discount/` (customer-specific discount).

## 4. Feedback — `/feedbacks/app_list/`

Tabs: **Petpooja Feedback · Complaints · Ratings & Reviews**. Filters: date, Order Type, Customer Name/Phone. Views: Customer Wise / Feedback Wise. Export. Endpoints `/feedbacks/applist/`, `/feedbacks/order_detail/`.
Sources (marketplace): Feedback Management app, Link-based Feedback (SMS), QR Code based Feedback.

## 5. Petpooja Loyalty — `/market/restaurant_loyalty_details`

Marketplace product page: Description, Process Flow, Plan Rates (1 Year). Purchase modal: select loyalty program, "My Loyalty Name"; pay via UPI QR (GPay/PhonePe) or card/net-banking (Zaakpay gateway: `/zaakpays/payment_initiate`, `/zaakpays/check_payment_response/`, `/zaakpays/phonepe_response/`); promo code `/market/verify_marketplace_promocode_apply/`.
Loyalty behaviour at POS is configured in [Connected Services › Loyalty](./07-outlet-configuration.md#10-connected-services).

## 6. Google Business (Beta) — sidebar item (no page observed).

## 7. Marketing Automation — `marketing.petpooja.com`

Plans: **Core · Growth (most popular) · Scale** (per year + GST). Solutions advertised:

- WhatsApp campaigns, marketing templates, automation templates, performance tracking
- Advertisements: Influencer + Meta, Meta platform, Snapchat / JioHotstar (coming soon), YouTube Shorts, local campaigns
- Customers: smart suggestions, customer profiling, customer segments, e-bill
- Reputation: feedback, loyalty

Segments: Food courts & canteens, Cafe, Fine dine, Bar & brewery, Pizzeria, QSR, Desserts, Large chains, Bakery, Cloud kitchens, Retail, Grocery, Supermarket, Book store, Dealers & distributors.

## Inferred entities

`Customer` (phone (masked), name, email, dob, anniversary, source, dnd, crm_eligible, tags[], wallet, loyalty_points), `CustomerTag`, `Segment` (rules, status, refreshed_at), `Campaign` (type, channel, template, schedule, status, credits), `MessageCredit` (SMS/WhatsApp balance), `Feedback` (order, ratings, comments, type feedback/complaint/review), `LoyaltyProgram`, `LoyaltyTxn`.