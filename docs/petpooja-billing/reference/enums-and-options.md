# Enums and option lists

**Source:** `<select>` / radio options in server HTML (2026-11-19). Outlet-defined lists (custom payment types, sub-order types, tags) are examples only. Use these as seed values for your own enums; the Petpooja labels are reproduced so the UI can match operator expectations.

## Orders

| Enum | Values |
| --- | --- |
| OrderType | `delivery` (Delivery / Home Delivery), `pickup` (Pick Up / Parcel), `dine_in` (Dine In) |
| OrderStatus | `saved`, `printed`, `settled`, `cancelled`, `complimentary`, `sales_return` (filter also has "Saved + Printed") |
| OrderOtherStatus (filter) | `discount_gt_0`, `tax_gt_0`, `bill_updated`, `bill_reprinted` |
| PaymentType | `not_paid`, `cash`, `card`, `due`, `other`, `wallet`, `upi`, `online`, `part` (split) + outlet custom types |
| GstinFilter | `all`, `with_gstin`, `without_gstin` |
| AmountOperator | `=`, `>`, `<` |
| KotStatus | `active`, `used_in_bill`, `cancelled`, `shifted` (+ "modified" flag) |
| OnlineOrderStatus | `waiting_for_acceptance`, `accepted`, `preparing_kot_created`, `preparing_bill_created`, `food_ready`, `dispatched`, `delivered`, `cancelled` |
| OnlineRecordType | `last_24h`, `old_records` |
| OrderSource | `pos`, `captain`, `online_aggregator`, `kiosk`, `scan_qr`, `own_website`, `call_center`, `token` |
| AutoPrintStatus (KOT) | `none`, `food_ready`, `dispatched` |

## Menu

| Enum | Values |
| --- | --- |
| MenuGroup | `veg`, `non_veg`, `others` |
| Dietary | `veg`, `non_veg`, `egg` |
| MenuArea (default) | `base`, `home_delivery`, `parcel`, `dine_in` |
| ItemFlag | `O` online, `V` has variation, `A` has addons, `C` combo, `F` favourite, `K` kiosk, `D` dine-in QR |
| AssignmentFilter | `all`, `active`, `inactive`, `assigned`, `not_assigned` |
| TaxCreateBy | `gst_slab`, `vat`, `custom` |
| GstSlab | `gst_5`, `gst_18`, `gst_40`, `igst` (auto-split to CGST + SGST) |
| TaxMode | `forward` (exclusive), `backward` (inclusive), `tax_on_tax` |
| ValueType | `percentage`, `fixed` |
| DiscountChannel | `pos`, `online`, `zomato`, `kiosk`, `google_pay`, `os_aggregator`, `mr_divert`, `irctc` |
| DiscountType | `percentage`, `fixed`, `bogo`, `dish`, `flat_rate`, `bxgy`, `freebie`, `fixed_price` |
| DiscountApplyOn | `core` (subtotal), `total` |
| DiscountApplicableOn | `all`, `categories`, `items` |
| BogoGetPriceOrder | `lower_price`, `higher_price`, `same_items_only` |
| DealType | `auto_no_code`, `code_no_validation`, `assigned_coupon` |
| SpecialNoteType | `item_note`, `cooking_preference`, `order_note`, `allergen` |
| CommissionType | `none`, `percentage`, `fixed` |
| ImageUploadModule | `item`, `category`, `addon` |
| ImageUploadTarget | `platform` (Swiggy, Zomato, Kiosk, Talabat, …), `brand` (logo) |
| StoreOffReason | `high_rush_kitchen_full`, `raw_material_out_of_stock`, `staff_unavailable`, `nearing_closing`, `timings_incorrect`, `temporarily_closed`, `menu_issues`, `other` |
| StoreOffDuration | `30m`, `1h`, `2h`, `custom` |
| ItemOffDuration | `2h`, `4h`, `8h`, `24h`, `indefinite`, `next_business_day`, `custom` |

## Outlet configuration

| Enum | Values |
| --- | --- |
| OperationType | `COCO`, `COFO`, `FOCO`, `FOFO` (company/franchise owned × operated) |
| SeatingCapacity | `1-10`, `10-50`, `50-100`, `100+` |
| SupplyType | `service`, `goods`, `both` |
| UiMode | `keyboard`, `touch` |
| DefaultScreen | `billing`, `table_management` |
| SortOrder | `asc`, `desc` |
| ItemSorting | `a_z`, `price`, `rank` |
| TipType | `none`, `percentage`, `fixed` |
| TableLockOn | `save_and_print`, `settle_and_save`, `none` |
| RoundOff | `normal`, `up`, `down`, `none`; increments `1`, `0.5`, `0.25`, `0.1`, `0.05`; decimals 1–3 |
| ContainerChargeMode | `item_wise`, `order_wise`, `fixed_per_item` |
| SurchargePaymentMode | `cash`, `card`, `due`, `other` |
| BillPrintGrouping | `none`, `category_wise_tax`, `brand_wise` |
| OrderBarcodeMode | `full_id`, `last_4` |
| AutoCancelMinutes | 15–60 |
| AdvanceReminderMinutes | none, 15–180 |
| TurnOffUnit | `none`, `days`, `hours`, `minutes` |
| SyncProtocol | `secured`, `normal` |
| VoiceNotificationLang | `en`, `hi` |
| AutoFinalizeDays | 30, 45, 60 |

## Payments, wallet, accounting

| Enum | Values |
| --- | --- |
| PayoutStatus (27) | `customer_paid`, `provider_payment_initiated`, `provider_payment_in_process`, `provider_payment_done`, `awaiting_bank_approval`, `petpooja_payment_received`, `petpooja_payment_initiated`, `transfer_initiated_to_bank`, `transferred_to_bank`, `failed_transaction`, `refund_initiated`, `refunded_to_customer`, `waived_paid_service_amount`, `manual_adjustment`, `return_from_bank`, `account_mismatch`, `ifsc_wrong`, `account_details_missing`, `account_closed`, … |
| WalletStatus | `active`, `inactive`, `blocked` |
| WalletTxnType | `issue`, `topup`, `redeem`, `refund`, `return_card`, `replace_card`, `reset` |
| CashMovementType | `expense`, `withdrawal`, `cash_topup` |
| LogUpdateType | `update`, `removed` |
| ServicePaymentTab | `pg`, `swiping`, `mdr`, `hardware`, `security_deposit`, `monthly_invoice`, `ledger` |
| ServicePaymentMode | `online`, `manual` |
| TransactionParty | `restaurant`, `suppliers_hub` |

## Users & devices

| Enum | Values |
| --- | --- |
| StaffUserType | `billing_user`, `delivery_boy`, `waiter`, `captain`, `online_acceptance_app` |
| DevicePlatform | `windows`, `linux`, `mac`, `android`, `ios` |
| DeviceApp | `pos_desktop`, `pos_local_server`, `printer_app`, `merchant`, `online_acceptance`, `captain`, `token`, `inventory`, `feedback`, `kds`, `mfr_scanner`, `reservations`, `digital_display`, `android_pos` |

## Inventory

| Enum | Values |
| --- | --- |
| PartyType | `supplier`, `restaurant`, `kitchen` |
| DocPaymentStatus | `unpaid`, `paid`, `partially_paid` |
| DocStatus | `saved`, `sent_and_emailed`, `processed`, `cancelled`, `rejected`, `pending_approval` (wastage) |
| DocumentType | `purchase`, `purchase_order`, `purchase_return`, `sale`, `transfer`, `sales_return`, `wastage` |
| StockCountFrequency | `daily`, `weekly`, `bi_weekly`, `monthly`, `yearly` |
| StockLevel | `at_par`, `minimum`, `negative`, `maximum` |
| UnitKind | `purchase`, `consumption` |
| BackdatePolicy | `none`, `today`, `future`, `past_60_days` |

## CRM & marketing

| Enum | Values |
| --- | --- |
| CustomerSource | `pos`, `crm`, `import`, `feedback`, `whatsapp`, `web_order`, `enrichment` |
| MessageChannel | `sms`, `whatsapp`, `email` |
| CampaignStatus | `pending`, `cancelled`, `delivered` |
| CampaignType | `scheduled`, `on_bill_print`, `link_feedback`, `birthday`, `anniversary`, `delivery_accepted`, `delivery_dispatched`, `ebill`, `loyalty_otp`, `loyalty_redeem`, `loyalty_credit`, `loyalty_revert`, `wallet_otp`, `wallet_redeem_card`, `wallet_credit`, `wallet_return_otp`, `wallet_return_balance`, `wallet_redeem`, `wallet_activate`, … |
| FeedbackKind | `feedback`, `complaint`, `rating_review` |

## Logs & support

| Enum | Values |
| --- | --- |
| MenuTriggerStatus | `success`, `failed`, `in_process` |
| SupportCategory (~35) | `reinstallation`, `installation`, `printer`, `edc`, `loan`, `reconciliation`, `billing`, `payment`, `gst`, `report`, `kot`, `inventory`, `reset_bill_no`, `printer_config`, `menu`, `discount_config`, `account_details`, `login`, `training`, … |

## Shared UI

| Enum | Values |
| --- | --- |
| DateRangePreset | `today`, `yesterday`, `last_7_days`, `last_30_days`, `this_month`, `last_month`, `custom` |
| ChartType | `column`, `area`, `line` |
| ExportFormat | `xlsx`, `csv`, `pdf`, `txt` |
| Weekday | `sun`…`sat` + `all` |