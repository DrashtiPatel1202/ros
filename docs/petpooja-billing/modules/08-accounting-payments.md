# Module: Accounting & Payments

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** server HTML parse

| Page | Route |
| --- | --- |
| Payment Information (digital payment payouts) | `/orders/reconcilation_list/` |
| Virtual Wallet | `/users/virtual_wallet_list/` |
| Online Order Reconciliation | `/onlines/reconciliation_list_new/` |
| GST Information | `/users/gst_information/` |
| Bank Details | `/orders/bank_detail_listing/` |
| Expense & Withdrawal | `/items/expense_list/` |
| Service Payment History | `/orders/invoice_credit_service_list/` |
| Loan Information | `/orders/loan_invoice_list/` |
| Denomination | `/items/denomination_list/` |

## 1. Payment Information — `/orders/reconcilation_list/`

Tracks settlement of digital payments (UPI/EDC/wallets) collected through Petpooja-integrated providers and their payout to the restaurant bank account. Chart: Last 15 Days Payment.

| Filter | Key | Options |
| --- | --- | --- |
| From / To date | `startdate`, `enddate` | |
| Status | `petpooja_status` | Customer Paid, Provider Payment Initiated, Provider Payment In Process, Provider Payment Done, Awaiting Bank Approval (higher amount), Petpooja Payment Received, Petpooja Payment Initiated, Transfer Initiated To Bank, Transferred To Bank, Failed Transaction, Refunded To Customer, Waived Of Paid Service Amount, Manual Adjustment, Refund Initiated, Return From Bank, Account Mismatch, IFSC Code Is Wrong, Account details missing, Account is Closed, … (27) |
| Provider | `provider` | Mobikwik, Ezetap, EDC Machine, Ruplee, Paytm Wallet, Home Website, UPI, JioMoney, BijliPay, PayTM QR, Virtual, Bharat QR, Sodexo, Pine Labs, UPI QR Code, Worldline, Virtual Wallet API, Mswipe, … (~75) |
| Order ID | `orderid` | |

Exports; `POST /users/download_payout_report/`; detail `/paid_services/view_paid_service_info/`; list `/orders/reconcilationlist/`.

```mermaid
stateDiagram-v2
  [*] --> CustomerPaid
  CustomerPaid --> ProviderPaymentInitiated --> ProviderPaymentInProcess --> ProviderPaymentDone
  ProviderPaymentDone --> PetpoojaPaymentReceived --> PetpoojaPaymentInitiated --> TransferInitiatedToBank --> TransferredToBank
  TransferInitiatedToBank --> ReturnFromBank: bank reject (IFSC wrong, account closed, mismatch)
  CustomerPaid --> FailedTransaction
  CustomerPaid --> RefundInitiated --> RefundedToCustomer
```

## 2. Virtual Wallet — `/users/virtual_wallet_list/`

Closed-loop prepaid wallet/card for customers (e.g. canteens, food courts).

Filters: Customer Mobile No., date range. Actions: Export All, change status, exclude from balance reset, **Reset All Customer Balance** (OTP-protected).

| Modal | Fields |
| --- | --- |
| Change Status for Mobile No. | Status\* (Active, Inactive, Block), Reason\* |
| Exclude customer from reset balance | checkbox |
| Reset All Customer Balance | Proceed/Cancel + OTP |

Endpoints: `/users/get_wallet_history/`, `/users/get_customer_wallet_history/`, `/users/add_virtual_wallet_card/`, `/users/upload_wallet_customers/` (bulk), `/users/topup_virtual_wallet_card/`, `/users/card_details_virtual_wallet/`, `/users/give_refund_virtual_wallet/`, `/users/change_wallet_transaction_payment_mode/`, `/users/return_virtual_wallet_card/`, `/users/replace_card_virtual_wallet/`, `/users/change_card_wallet_status/`, `/users/reset_card_customer_balance_otp/`, `/users/reset_card_customer_balance`, `/users/reset_exclude_customer/`.

Wallet operations: issue card, top-up, redeem, refund, return card (balance back), replace card, block.

## 3. Online Order Reconciliation — `/onlines/reconciliation_list_new/`

Matches aggregator (Zomato/Swiggy) payouts to POS orders. Requires aggregator integration and tax configuration ("There is no tax configure" / "You have not integrated Petpooja with Zomato and Swiggy" empty states). **Raise Dispute** modal: From Email, Dispute Type (Mismatch Order), Email template. List `/onlines/reconciliationlist_new/`. Also marketed as paid add-on "Online Order Reconciliation".

## 4. GST Information — `/users/gst_information/`

Business details printed on **Petpooja's invoices to the restaurant** (subscription billing).

| Field | Key |
| --- | --- |
| Has GST? | `type` Yes/No |
| GST No (verify / edit) | `invoice_gstin` (lookup `/app/search_gst_details/`) |
| Registered Name / Address | `invoice_name`, `invoice_address` |
| State / City | `invoice_state_id`, `invoice_city_id` (`/users/get_gst_city/`) |
| VAT No., PAN, CIN | `invoice_vat`, `invoice_pan`, `invoice_cin` |
| Location, Zip | `invoice_location`, `invoice_zipcode` |

## 5. Restaurant Bank Details — `/orders/bank_detail_listing/`

Bank accounts for payouts. Endpoints `/orders/bankdetaillist/`, `/orders/add_bank_details/`, `/orders/delete_bank_detail/`.

## 6. Expense Management — `/items/expense_list/`

Tabs: **Expense Listing · Expense Master · Withdrawal Listing · Withdrawal Master · Cash Top-Up Listing · Cash Top-Up Master**. Filters: date range, Title. Export.
Expenses/withdrawals/top-ups are recorded at the POS (cash drawer movements) against master heads; changes are logged in Expense/Withdrawal/Cash Top-Up Logs. Endpoints `/items/expenselist/`, `/items/expense_detail/`.

## 7. Service Payment History — `/orders/invoice_credit_service_list/`

Petpooja's billing of the restaurant (subscription, hardware, transaction fees).

Tabs: **PG Transactions · Swiping Transactions · MDR Transactions · Hardware · Security Deposit · Monthly Invoices · Restaurant Ledgers**

Filters: Transaction Type (All, Restaurant, Suppliers Hub), Service type, Order ID (`checksum`), Payment Type (Online, Manual), Proforma No., Proforma date range. Modal: Cancel Proforma (reason\*). Endpoints `/orders/phlist/`, `/orders/add_credit_service/`.

## 8. Loan Information — `/orders/loan_invoice_list/`

Merchant loans (Petpooja Loan) and repayment invoices. `/orders/loanlist/`, `/orders/loan_invoice_detail/`.

## 9. Denomination — `/items/denomination_list/`

Cash denominations (notes/coins) available at POS for cash counting at day end. Available / Not Available. `/items/denomination_list_ajax/`, `/items/denomination/`.

## Inferred entities

`PaymentTransaction` (provider, order_id, amount, petpooja_status, payout_ref), `BankAccount`, `WalletCard` (customer_phone, card_no, balance, status), `WalletTxn` (type topup/redeem/refund/return, mode), `ExpenseHead` (type expense/withdrawal/topup), `ExpenseEntry`, `ServiceInvoice`/`Proforma`, `Loan`, `Denomination`, `GstProfile`.