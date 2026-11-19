import { useState } from "react"
import { Outlet } from "react-router-dom"
import type { BillingSession } from "../api"
import { DeviceMapModal } from "./DeviceMapModal"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function AppShell({
  session,
  onSignOut,
}: {
  session: BillingSession
  onSignOut: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [deviceOpen, setDeviceOpen] = useState(false)

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <Header
        session={session}
        onOpenDeviceMap={() => setDeviceOpen(true)}
        onSignOut={onSignOut}
      />
      <main id="content">
        <Outlet />
      </main>
      {deviceOpen && (
        <DeviceMapModal outletName={session.outlet.name} onClose={() => setDeviceOpen(false)} />
      )}
    </div>
  )
}
