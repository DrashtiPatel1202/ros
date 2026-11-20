import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import type { BillingSession } from "../api"
import { DeviceMapModal } from "./DeviceMapModal"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function AppShell({
  session,
  onSignOut,
  onOutletChange,
}: {
  session: BillingSession
  onSignOut: () => void
  onOutletChange: (session: BillingSession) => void
}) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [deviceOpen, setDeviceOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)")
    const apply = () => setNarrow(query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [])

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-open-mobile" : ""}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar
        collapsed={collapsed}
        hidden={narrow && !mobileOpen}
        onToggle={() => setCollapsed((v) => !v)}
        onNavigate={() => setMobileOpen(false)}
      />
      <Header
        session={session}
        menuOpen={mobileOpen}
        onToggleMenu={() => setMobileOpen((open) => !open)}
        onOpenDeviceMap={() => setDeviceOpen(true)}
        onSignOut={onSignOut}
        onOutletChange={onOutletChange}
      />
      <main id="content">
        <Outlet key={session.outlet.id} />
      </main>
      {deviceOpen && (
        <DeviceMapModal outletName={session.outlet.name} onClose={() => setDeviceOpen(false)} />
      )}
    </div>
  )
}
