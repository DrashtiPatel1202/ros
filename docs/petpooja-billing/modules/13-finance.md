# Module: Petpooja Finance (`finance.petpooja.com`)

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** live SPA navigation (via `/users/finance_redirect`)

Welcome page: "Petpooja Finance gives merchants seamless access to quick loans, working capital, and easy banking integrations." Cards: **Banking** (open current account), **Payments** (link EDC device / get new one).

Sidebar: **Dashboard · Transactions · Expenses · Risk Analysis · Marketplace**

## Dashboard (`/`)

- Date presets (Yesterday, …); Total (N bills) split: Card/UPI, Wallets, Cash, Online, Due, Others
- Payment Distribution; Month-wise payment trends (last 6 months)
- Deductions & Tips: Charges, Tax, Discount, Tips
- Online Order Reconciliation summary
- Card & UPI Payouts: EDC amount, UPI amount, provider charges, aggregate payout; last 4 months swipe machine charges
- Digital Payment Utilization Trend (EDC, UPI, more)
- Cash: Opening balance, Total bills, Closing balance, **Missing Amount = Opening + Bills − Closing** (from day-end); weekly cash utilisation trend

## Transactions (`/transactions`)

Tabs: All Orders, Cash, Card/UPI, Wallet, Online/Others. Filters: From, Bill Status (Success…), Order Type, Sub Order Type, Payment Type, Bill Number. Columns: Bill No · Tax · Discount · Total · Tip · Status · Created On.

## Expenses (`/expenses`)

KPIs: Total Expenses, Total Withdrawals, Total Cash Top-up, Average Expense (vs previous period). Charts: Expense trend (daily), Expenses by category, Payment source. Filters: From, Status, Type, Category, Paid From, Min/Max amount. Columns: Expense Date · Description · Amount · Billing User.

## Risk Analysis / Leakage Watch (`/leakage-watch`)

Last 30 days risk distribution (amount · share of exposure); "Potential exposure is an indicator of value at risk, not a confirmed loss"; "Where your money is at risk". Dimensions (from dashboard): unverified payments by tender, expense drain, counter giveaways (discounts/cancels/freebies outside policy), KOT vs bill mismatch.

## Marketplace (`/marketplace`)

Tabs: Swipe Machine Integration · QR Payments · Loans. EDC partners: BharatPe, Pine Labs, ICICI Bank, Mosambee, Razorpay, Paytm (View details / Request Service). Also KharchaPay (UPI expense wallets for staff).

## Implementation guidance

Finance is an analytics layer over orders, payments, day-end cash and expenses — build after those modules. Leakage rules are deterministic checks (payment without bill, bill without payment, amount mismatch, unapproved discount/cancel/NC, KOT without bill).