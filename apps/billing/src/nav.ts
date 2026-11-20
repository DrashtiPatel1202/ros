export type NavLeaf = {
  id: string
  label: string
  path: string
  badge?: "New" | "Beta"
  external?: boolean
}

export type NavGroup = {
  id: string
  label?: string
  collapsible?: boolean
  children: (NavLeaf | NavSubGroup)[]
}

export type NavSubGroup = {
  id: string
  label: string
  children: NavLeaf[]
}

export function isSubGroup(item: NavLeaf | NavSubGroup): item is NavSubGroup {
  return "children" in item
}

export const APP_NAME = "Restaurant Order Management"

/** Billing sidebar. */
export const SIDEBAR: NavGroup[] = [
  {
    id: "top",
    children: [
      { id: "dashboard", label: "Dashboard", path: "/users/dashboard" },
      { id: "dynamic-dashboard", label: "Dynamic Dashboard", path: "/users/ai_report_redirect", badge: "New" },
    ],
  },
  {
    id: "daily",
    label: "Daily Operations",
    collapsible: true,
    children: [
      { id: "pos-billing", label: "POS Billing", path: "/pos/billing" },
      { id: "live-orders", label: "Live Orders", path: "/orders/running_orders" },
      { id: "all-orders", label: "All Orders", path: "/orders/order_list" },
      { id: "online-orders", label: "Online Orders", path: "/onlines/online_dashboard" },
      { id: "dynamic-reports", label: "Dynamic Reports", path: "/users/data_analytics" },
      { id: "kot", label: "KOT", path: "/items/kot_list" },
    ],
  },
  {
    id: "menu",
    label: "Menu",
    collapsible: true,
    children: [
      { id: "menu-mgmt", label: "Menu & Discounts", path: "/menus/menu_management" },
      { id: "menu-images", label: "Multi-Item Images Upload", path: "/menus/upload_item_images" },
      { id: "menu-onoff", label: "Menu on/off", path: "/menus/item_on_off" },
    ],
  },
  {
    id: "inventory",
    children: [{ id: "inventory", label: "Inventory", path: "/inventory_dashboard/new_inventory_dashboard" }],
  },
  {
    id: "marketing-auto",
    children: [
      { id: "mkt-auto", label: "Marketing Automation", path: "/users/marketing_redirect", badge: "New" },
    ],
  },
  {
    id: "finance",
    children: [{ id: "finance", label: "Finance", path: "/users/finance_redirect", badge: "New" }],
  },
  {
    id: "reports",
    label: "Reports",
    collapsible: true,
    children: [
      { id: "day-end", label: "Day End Summary", path: "/orders/day_end_summary" },
      { id: "other-reports", label: "Other Reports", path: "/custom_reports/reports" },
      { id: "report-noti", label: "Report Notification", path: "/custom_reports/report_notifications" },
      { id: "delivery-mgmt", label: "Delivery Management", path: "/orders/delivery_services_list" },
    ],
  },
  {
    id: "management",
    label: "Management",
    collapsible: true,
    children: [
      {
        id: "configuration",
        label: "Configuration",
        children: [
          { id: "outlet-config", label: "Outlet Configuration", path: "/users/res_new/1" },
          { id: "sub-order", label: "Sub Order Type", path: "/items/sub_order_type_list" },
          { id: "delivery-distance", label: "Delivery Distance", path: "/items/delivery_distance_list" },
          { id: "area-charges", label: "Area/Locality Delivery Charges", path: "/users/area_wise_delivery_charge_list" },
          { id: "floor-plan", label: "Floor Plan", path: "/users/floor_plan" },
        ],
      },
      {
        id: "accounting",
        label: "Accounting",
        children: [
          { id: "payment-info", label: "Payment Information", path: "/orders/reconcilation_list" },
          { id: "virtual-wallet", label: "Virtual Wallet", path: "/users/virtual_wallet_list" },
          { id: "online-recon", label: "Online Order Reconciliation", path: "/onlines/reconciliation_list_new" },
          { id: "gst-info", label: "GST Information", path: "/users/gst_information" },
          { id: "bank", label: "Bank Details", path: "/orders/bank_detail_listing" },
          { id: "expense", label: "Expense & Withdrawal", path: "/items/expense_list" },
          { id: "service-pay", label: "Service Payment History", path: "/orders/invoice_credit_service_list" },
          { id: "loan", label: "Loan Information", path: "/orders/loan_invoice_list" },
          { id: "denomination", label: "Denomination", path: "/items/denomination_list" },
        ],
      },
      {
        id: "user-mgmt",
        label: "User Management",
        children: [{ id: "biller-app", label: "Biller App", path: "/users/desktop" }],
      },
      {
        id: "user-logs",
        label: "User Logs",
        children: [
          { id: "online-store-logs", label: "Online Store Logs", path: "/logs/online_log_status/1" },
          { id: "item-onoff-logs", label: "Online Item On/Off Logs", path: "/logs/online_log_status/2" },
          { id: "auto-accept-logs", label: "Auto Accept Change Logs", path: "/logs/auto_accept_log_status" },
          { id: "support", label: "Support Management", path: "/logs/support_note_list" },
          { id: "notifications", label: "Notification", path: "/logs/notifications_list" },
          { id: "menu-trigger", label: "Menu Trigger Logs", path: "/settings/zomato_menu_callbacks" },
          { id: "closing-hours", label: "Closing Hour Logs", path: "/logs/closing_hours_logs" },
          { id: "expense-logs", label: "Expense Logs", path: "/logs/expense_logs" },
          { id: "withdrawal-logs", label: "Withdrawal Logs", path: "/logs/withdrawl_logs" },
          { id: "cashtopup-logs", label: "Cash Top-Up Logs", path: "/logs/cashtopup_logs" },
        ],
      },
      {
        id: "explore",
        label: "Explore Products",
        children: [
          { id: "marketplace", label: "Marketplace", path: "/market/services" },
          { id: "marketplace-settings", label: "Marketplace Setting", path: "/market/settings" },
        ],
      },
      { id: "audit", label: "Audit Trail", path: "/users/logs_redirect", badge: "New" },
      { id: "device-map", label: "Device Mapping", path: "/users/desktop_application" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    collapsible: true,
    children: [
      { id: "crm-marketing", label: "Marketing", path: "/crm/crm_dashboard" },
      { id: "campaign", label: "Campaign", path: "/users/send_sms_history" },
      { id: "google-biz", label: "Google Business", path: "/users/google_business", badge: "Beta" },
      { id: "customers", label: "Customers", path: "/users/customer_list" },
      { id: "feedback", label: "Feedback", path: "/feedbacks/app_list" },
      { id: "loyalty", label: "Loyalty", path: "/market/restaurant_loyalty_details" },
    ],
  },
  {
    id: "aggregator",
    label: "Aggregator Center",
    collapsible: true,
    children: [{ id: "swiggy-help", label: "Swiggy", path: "/users/helpcenter/2" }],
  },
]

export const PRODUCT_SWITCHER = [
  { label: "Bazaar", path: "/bazaar" },
  { label: "Reconciliation", path: "/onlines/reconciliation_list_new" },
  { label: "Insights", path: "/users/data_analytics" },
  { label: "Marketplace", path: "/market/services" },
  { label: "Orders", path: "/orders/order_list" },
  { label: "Suppliers", path: "/suppliers" },
  { label: "Menu", path: "/menus/menu_management" },
  { label: "Inventory", path: "/inventory_dashboard/new_inventory_dashboard" },
  { label: "Reports", path: "/custom_reports/reports" },
]

export const EXPLORE_PRODUCTS = {
  PRODUCTS: [
    { label: "Attendo", desc: "Payroll & attendance", path: "/explore/attendo" },
    { label: "Task", desc: "Project management", path: "/explore/tasks" },
    { label: "Finance", desc: "Payments & risk", path: "/users/finance_redirect" },
    { label: "Marketing Automation", desc: "Campaigns & ads", path: "/users/marketing_redirect" },
    { label: "TRM", desc: "Table reservations", path: "/explore/trm" },
    { label: "Purchase", desc: "AI inventory", path: "/explore/purchase" },
  ],
  OPERATIONS: [
    { label: "Captain Ordering App", path: "/explore/captain" },
    { label: "Kitchen Display System", path: "/explore/kds" },
    { label: "Website", path: "/explore/website" },
    { label: "Kiosk", path: "/explore/kiosk" },
  ],
  INTEGRATIONS: [
    { label: "Dynamic Reports", path: "/users/data_analytics" },
    { label: "Online Orders", path: "/onlines/online_dashboard" },
    { label: "Accounting", path: "/explore/accounting" },
    { label: "Loyalty", path: "/market/restaurant_loyalty_details" },
  ],
}

export const AI_PROMPTS = [
  "Generate a graph for next weeks sales report",
  "Predict profit and loss for next month",
  "Get me an item-wise profit and loss",
  "What were my top-selling items yesterday?",
  "How much did I earn last month?",
  "What was my online sales channel-wise last quarter?",
  "How do I connect to customer support",
  "How do I add a new item in the menu",
  "How can I create a new outlet",
]

/** Screens that have a real page. Everything else stays routed but is hidden. */
export const IMPLEMENTED_PATHS = new Set([
  "/users/dashboard",
  "/users/edit_profile",
  "/orders/running_orders",
  "/orders/order_list",
  "/pos/billing",
  "/users/desktop",
  "/users/res_new/1",
  "/items/sub_order_type_list",
  "/items/delivery_distance_list",
  "/users/area_wise_delivery_charge_list",
  "/users/floor_plan",
  "/users/floor_plan/1",
  "/items/kot_list",
  "/menus/menu_management",
  "/menus/menu_new/all",
  "/onlines/online_dashboard",
  "/orders/day_end_summary",
  "/orders/delivery_services_list",
  "/menus/item_on_off",
  "/inventory_dashboard/new_inventory_dashboard",
  "/inventories/rm_list/all",
  "/inventories/new_item_stock_list",
  "/inventories/purchase_list",
  "/inventories/purchase_order_list",
  "/inventories/wastage_list",
  "/inventories/new_manual_stock",
  "/inventories/inv_recipe_list",
  "/inventories/supplier_management",
  "/inventories/inventoy_setting",
  "/users/desktop_application",
  "/users/apps",
  "/users/logs_redirect",
  "/orders/reconcilation_list",
  "/users/virtual_wallet_list",
  "/onlines/reconciliation_list_new",
  "/users/gst_information",
  "/orders/bank_detail_listing",
  "/items/expense_list",
  "/orders/invoice_credit_service_list",
  "/orders/loan_invoice_list",
  "/items/denomination_list",
  "/logs/online_log_status/1",
  "/logs/online_log_status/2",
  "/logs/auto_accept_log_status",
  "/logs/support_note_list",
  "/logs/notifications_list",
  "/settings/zomato_menu_callbacks",
  "/logs/closing_hours_logs",
  "/logs/expense_logs",
  "/logs/withdrawl_logs",
  "/logs/cashtopup_logs",
  "/market/services",
  "/market/settings",
])

export function isImplemented(path: string) {
  return IMPLEMENTED_PATHS.has(path)
}

export function titleForPath(pathname: string): string {
  const normalized = pathname.replace(/\/$/, "") || "/"
  for (const group of SIDEBAR) {
    for (const child of group.children) {
      if (isSubGroup(child)) {
        for (const leaf of child.children) {
          if (leaf.path === normalized) return leaf.label
        }
      } else if (child.path === normalized) {
        return child.label
      }
    }
  }
  if (normalized === "/users/edit_profile") return "Edit Profile"
  if (normalized === "/pos/billing") return "POS Billing"
  if (normalized.startsWith("/inventor")) return "Inventory"
  if (normalized === "/menus/menu_new/all") return "All In One Menu"
  if (normalized.startsWith("/users/resdetails")) return "Outlet Details"
  if (normalized.startsWith("/users/res_contact")) return "Contact Details"
  if (normalized.startsWith("/users/res_timing")) return "Outlet Timings"
  if (normalized.startsWith("/users/res_cpt_nqr")) return "Payment"
  if (normalized.startsWith("/users/res_invoice_list")) return "Invoice Sequence"
  if (normalized.startsWith("/users/floor_plan/design")) return "Floor Plan"
  if (normalized === "/users/floor_plan" || normalized === "/users/floor_plan/1") return "Floor Plan"
  if (normalized.startsWith("/users/billing_display_setting")) return "Display"
  if (normalized.startsWith("/users/pos_configuration")) return "Print logo"
  if (normalized.startsWith("/users/billing_calculations")) return "Calculations"
  if (normalized.startsWith("/users/connected_services")) return "Connected Services"
  if (normalized.startsWith("/users/bill_kot_setting")) return "Print (Bill & KOT)"
  if (normalized.startsWith("/users/res_other_setting")) return "Customer"
  if (normalized.startsWith("/users/pending_order_setting")) return "Online / Advance Order"
  if (normalized.startsWith("/users/res_system")) return "Billing System"
  if (normalized.startsWith("/users/res_notification_system")) return "SMS / Notification"
  if (normalized === "/users/apps" || normalized === "/users/petpooja_application") return "Apps"
  if (normalized.startsWith("/logs/") || normalized.startsWith("/settings/zomato")) return "Logs"
  if (normalized.startsWith("/market/")) return "Marketplace"
  if (normalized === "/users/add_quick_links") return "Quick Links"
  if (normalized === "/users/terms") return "Terms & Conditions"
  if (normalized === "/users/privacy") return "Privacy Policy"
  return APP_NAME
}
