import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ApiError, api, type BillingSession } from "../api"
import { EXPLORE_PRODUCTS, isImplemented } from "../nav"

export function Header({
  session,
  menuOpen,
  onToggleMenu,
  onOpenDeviceMap,
  onSignOut,
  onOutletChange,
}: {
  session: BillingSession
  menuOpen: boolean
  onToggleMenu: () => void
  onOpenDeviceMap: () => void
  onSignOut: () => void
  onOutletChange: (session: BillingSession) => void
}) {
  const [exploreOpen, setExploreOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [kitchens, setKitchens] = useState<{ id: number; name: string; timezone: string; current: boolean }[]>([])
  const [kitchenQuery, setKitchenQuery] = useState("")
  const [switchError, setSwitchError] = useState("")
  const [unread, setUnread] = useState(0)
  const exploreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) setExploreOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  useEffect(() => {
    void api.notifications().then((data) => setUnread(data.unread)).catch(() => setUnread(0))
  }, [])

  useEffect(() => {
    void api.outlets().then((data) => setKitchens(data.rows)).catch(() => setKitchens([]))
  }, [session.outlet.id])

  const visibleKitchens = kitchens.filter((kitchen) =>
    kitchen.name.toLowerCase().includes(kitchenQuery.trim().toLowerCase()),
  )

  const initial = session.adminName.slice(0, 1).toUpperCase()

  return (
    <header className="ps-header ps-header-new navbar navbar-expand-md sticky-top navbar-light bg-light menu-div">
      <button
        type="button"
        className="nav-toggle header-icon-btn"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        <i className={`bi ${menuOpen ? "bi-x-lg" : "bi-list"}`} />
      </button>
      <div className="outlet-switch position-relative">
        <button type="button" className="btn btn-link p-0 text-decoration-none text-dark" onClick={() => setSwitcherOpen((v) => !v)}>
          <i className="bi bi-shop me-1" />
          {session.outlet.name}
          <small className="ms-2">{session.outlet.brandCount} brands</small>
        </button>
        {switcherOpen && (
          <div className="outlet-menu" role="menu">
            <input
              className="form-control form-control-sm"
              placeholder="Search kitchen"
              value={kitchenQuery}
              onChange={(e) => setKitchenQuery(e.target.value)}
            />
            {switchError && <p className="text-danger small mb-1">{switchError}</p>}
            <div className="outlet-menu-list">
              {visibleKitchens.map((kitchen) => (
                <button
                  key={kitchen.id}
                  type="button"
                  role="menuitem"
                  className={kitchen.id === session.outlet.id ? "active" : ""}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (kitchen.id === session.outlet.id) {
                      setSwitcherOpen(false)
                      return
                    }
                    void api
                      .switchOutlet(kitchen.id)
                      .then((next) => {
                        onOutletChange(next)
                        window.location.reload()
                      })
                      .catch((caught) => {
                        if (caught instanceof DOMException && caught.name === "AbortError") return
                        setSwitchError(caught instanceof Error && caught.message ? caught.message : "Could not switch kitchen")
                      })
                  }}
                >
                  <i className="bi bi-shop" />
                  <span>{kitchen.name}</span>
                  {kitchen.id === session.outlet.id && <i className="bi bi-check-lg ms-auto" />}
                </button>
              ))}
              {!kitchens.length && <p className="text-muted small mb-0 px-2">Loading kitchens…</p>}
              {kitchens.length > 0 && !visibleKitchens.length && (
                <p className="text-muted small mb-0 px-2">No kitchen matches.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="header-actions">
        <button type="button" className="header-icon-btn" title="Map device" onClick={onOpenDeviceMap}>
          <i className="bi bi-phone" />
        </button>
        <Link to="/logs/notifications_list" className="header-icon-btn" title="Notifications">
          <i className="bi bi-bell" />
          <span className="badge-dot">{unread}</span>
        </Link>
        <div className="position-relative" ref={exploreRef}>
          <button type="button" className="btn-explore" onClick={() => setExploreOpen((v) => !v)}>
            <i className="bi bi-compass" /> <span className="explore-label">Explore Products</span>
          </button>
          {exploreOpen && (
            <div className="mega-menu">
              {(Object.keys(EXPLORE_PRODUCTS) as (keyof typeof EXPLORE_PRODUCTS)[])
                .map((section) => ({ section, items: EXPLORE_PRODUCTS[section].filter((item) => isImplemented(item.path)) }))
                .filter((section) => section.items.length > 0)
                .map(({ section, items }) => (
                <div key={section}>
                  <h6>{section}</h6>
                  {items.map((item) => {
                    const description = "desc" in item && typeof item.desc === "string" ? item.desc : ""
                    return (
                    <Link
                      key={item.path}
                      className="mega-item"
                      to={item.path}
                      onClick={() => setExploreOpen(false)}
                    >
                      <strong>{item.label}</strong>
                      {description ? <small>{description}</small> : null}
                    </Link>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dropdown">
          <button type="button" className="avatar-btn" onClick={() => setProfileOpen((v) => !v)}>
            {initial}
          </button>
          {profileOpen && (
            <div className="dropdown-menu dropdown-menu-end show" style={{ display: "block", right: 0, left: "auto" }}>
              <Link className="dropdown-item" to="/users/edit_profile" onClick={() => setProfileOpen(false)}>
                Edit Profile
              </Link>
              <Link className="dropdown-item" to="/users/apps" onClick={() => setProfileOpen(false)}>
                Apps
                <div className="small text-muted">Version - {session.appVersion}</div>
              </Link>
              <button type="button" className="dropdown-item" onClick={onSignOut}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
