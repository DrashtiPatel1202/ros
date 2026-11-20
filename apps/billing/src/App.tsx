import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { ApiError, api, type BillingSession } from "./api"
import { SignIn } from "./auth/SignIn"
import { EditProfile } from "./pages/EditProfile"
import { Dashboard } from "./pages/Dashboard"
import { LiveOrders } from "./pages/LiveOrders"
import { AllOrders } from "./pages/AllOrders"
import { ConfigHub, ConfigSection } from "./pages/Configuration"
import { AreaCharges, DeliveryDistances, SubOrderTypes } from "./pages/ConfigLists"
import { FloorPlan } from "./pages/FloorPlan"
import { FloorPlanList } from "./pages/FloorPlanList"
import { KotList } from "./pages/KotList"
import { AllInOneMenu, MenuHome, MenuOnOff } from "./pages/Menu"
import { InventoryPage } from "./pages/Inventory"
import { AccountingPage } from "./pages/Accounting"
import { AppsPage, DevicesPage } from "./pages/Devices"
import { LogsPage } from "./pages/Logs"
import { MarketplacePage } from "./pages/Marketplace"
import { StaffPage } from "./pages/Staff"
import { PosBilling } from "./pos/PosBilling"
import { AppShell } from "./shell/AppShell"
import { DayEnd, DeliveryManagement, OnlineOrders } from "./pages/Operations"
import { PlaceholderPage } from "./shell/PlaceholderPage"
import { APP_NAME, IMPLEMENTED_PATHS, SIDEBAR, isSubGroup, titleForPath } from "./nav"

const IMPLEMENTED = IMPLEMENTED_PATHS

function collectPaths(): string[] {
  const paths = new Set<string>([
    "/users/dashboard",
    "/users/edit_profile",
    "/users/apps",
    "/users/add_quick_links",
    "/users/terms",
    "/users/privacy",
    "/users/attendo_staff_cost_breakdown",
    "/bazaar",
    "/suppliers",
    "/explore/attendo",
    "/explore/tasks",
    "/explore/trm",
    "/explore/purchase",
    "/explore/captain",
    "/explore/kds",
    "/explore/website",
    "/explore/kiosk",
    "/explore/accounting",
  ])
  for (const group of SIDEBAR) {
    for (const child of group.children) {
      if (isSubGroup(child)) child.children.forEach((leaf) => paths.add(leaf.path))
      else paths.add(child.path)
    }
  }
  return [...paths]
}

const ALL_PATHS = collectPaths()

function TitleSync() {
  const location = useLocation()
  useEffect(() => {
    const title = titleForPath(location.pathname)
    document.title = title === APP_NAME ? APP_NAME : `${title} - ${APP_NAME}`
  }, [location.pathname])
  return null
}

export function App() {
  const [session, setSession] = useState<BillingSession | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState("")

  useEffect(() => {
    api
      .session()
      .then(setSession)
      .catch((caught) => {
        if (!(caught instanceof ApiError && caught.status === 401)) {
          setBootError(caught instanceof Error ? caught.message : "Could not reach API")
        }
      })
      .finally(() => setBooting(false))
  }, [])

  if (booting) {
    return <div className="p-5 text-center text-muted">Opening {APP_NAME}…</div>
  }

  if (bootError) {
    return (
      <div className="p-5 text-center">
        <p>The billing API is not reachable.</p>
        <p className="text-muted">{bootError}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  if (!session) {
    return <SignIn onSignedIn={setSession} />
  }

  async function signOut() {
    await api.signOut()
    setSession(null)
  }

  return (
    <BrowserRouter>
      <TitleSync />
      <Routes>
        <Route path="/pos/billing" element={<PosBilling />} />
        <Route
          element={
            <AppShell session={session} onSignOut={() => void signOut()} onOutletChange={setSession} />
          }
        >
          <Route path="/" element={<Navigate to="/users/dashboard" replace />} />
          <Route path="/users/dashboard" element={<Dashboard />} />
          <Route
            path="/users/edit_profile"
            element={<EditProfile session={session} onUpdated={setSession} />}
          />
          <Route path="/orders/running_orders" element={<LiveOrders />} />
          <Route path="/orders/order_list" element={<AllOrders />} />
          <Route path="/users/desktop" element={<StaffPage />} />
          <Route path="/users/desktop_application" element={<DevicesPage />} />
          <Route path="/users/apps" element={<AppsPage />} />
          <Route path="/users/petpooja_application" element={<Navigate to="/users/apps" replace />} />
          <Route path="/users/logs_redirect" element={<LogsPage />} />
          <Route path="/orders/reconcilation_list" element={<AccountingPage />} />
          <Route path="/users/virtual_wallet_list" element={<AccountingPage />} />
          <Route path="/onlines/reconciliation_list_new" element={<AccountingPage />} />
          <Route path="/users/gst_information" element={<AccountingPage />} />
          <Route path="/orders/bank_detail_listing" element={<AccountingPage />} />
          <Route path="/items/expense_list" element={<AccountingPage />} />
          <Route path="/orders/invoice_credit_service_list" element={<AccountingPage />} />
          <Route path="/orders/loan_invoice_list" element={<AccountingPage />} />
          <Route path="/items/denomination_list" element={<AccountingPage />} />
          <Route path="/logs/online_log_status/1" element={<LogsPage />} />
          <Route path="/logs/online_log_status/2" element={<LogsPage />} />
          <Route path="/logs/auto_accept_log_status" element={<LogsPage />} />
          <Route path="/logs/support_note_list" element={<LogsPage />} />
          <Route path="/logs/notifications_list" element={<LogsPage />} />
          <Route path="/settings/zomato_menu_callbacks" element={<LogsPage />} />
          <Route path="/logs/closing_hours_logs" element={<LogsPage />} />
          <Route path="/logs/expense_logs" element={<LogsPage />} />
          <Route path="/logs/withdrawl_logs" element={<LogsPage />} />
          <Route path="/logs/cashtopup_logs" element={<LogsPage />} />
          <Route path="/market/services" element={<MarketplacePage />} />
          <Route path="/market/settings" element={<MarketplacePage />} />
          <Route path="/users/res_new/1" element={<ConfigHub />} />
          <Route path="/users/resdetails/1" element={<ConfigSection section="outlet" />} />
          <Route path="/users/res_contact/1" element={<ConfigSection section="contact" />} />
          <Route path="/users/res_timing/1" element={<ConfigSection section="timings" />} />
          <Route path="/users/res_cpt_nqr/1" element={<ConfigSection section="payment" />} />
          <Route path="/users/res_invoice_list/1" element={<ConfigSection section="invoices" />} />
          <Route path="/users/billing_display_setting/1" element={<ConfigSection section="display" />} />
          <Route path="/users/pos_configuration/1" element={<ConfigSection section="printLogo" />} />
          <Route path="/users/billing_calculations/1" element={<ConfigSection section="calculations" />} />
          <Route path="/users/connected_services/1" element={<ConfigSection section="connected" />} />
          <Route path="/users/bill_kot_setting/1" element={<ConfigSection section="print" />} />
          <Route path="/users/res_other_setting/1" element={<ConfigSection section="customer" />} />
          <Route path="/users/pending_order_setting/1" element={<ConfigSection section="online" />} />
          <Route path="/users/res_system/1" element={<ConfigSection section="system" />} />
          <Route path="/users/res_notification_system/1" element={<ConfigSection section="notification" />} />
          <Route path="/items/sub_order_type_list" element={<SubOrderTypes />} />
          <Route path="/items/delivery_distance_list" element={<DeliveryDistances />} />
          <Route path="/users/area_wise_delivery_charge_list" element={<AreaCharges />} />
          <Route path="/users/floor_plan" element={<FloorPlanList />} />
          <Route path="/users/floor_plan/1" element={<FloorPlanList />} />
          <Route path="/users/floor_plan/design/:floorPlanId" element={<FloorPlan />} />
          <Route path="/items/kot_list" element={<KotList />} />
          <Route path="/menus/menu_management" element={<MenuHome />} />
          <Route path="/menus/menu_new/all" element={<AllInOneMenu />} />
          <Route path="/onlines/online_dashboard" element={<OnlineOrders />} />
          <Route path="/orders/day_end_summary" element={<DayEnd />} />
          <Route path="/orders/delivery_services_list" element={<DeliveryManagement />} />
          <Route path="/menus/item_on_off" element={<MenuOnOff />} />
          <Route path="/inventory_dashboard/new_inventory_dashboard" element={<InventoryPage />} />
          <Route path="/inventories/rm_list/all" element={<InventoryPage />} />
          <Route path="/inventories/new_item_stock_list" element={<InventoryPage />} />
          <Route path="/inventories/purchase_list" element={<InventoryPage />} />
          <Route path="/inventories/purchase_order_list" element={<InventoryPage />} />
          <Route path="/inventories/wastage_list" element={<InventoryPage />} />
          <Route path="/inventories/new_manual_stock" element={<InventoryPage />} />
          <Route path="/inventories/inv_recipe_list" element={<InventoryPage />} />
          <Route path="/inventories/supplier_management" element={<InventoryPage />} />
          <Route path="/inventories/inventoy_setting" element={<InventoryPage />} />
          {ALL_PATHS.filter((path) => !IMPLEMENTED.has(path)).map((path) => (
            <Route key={path} path={path} element={<PlaceholderPage pathname={path} />} />
          ))}
          <Route path="*" element={<PlaceholderPage pathname="/users/dashboard" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
