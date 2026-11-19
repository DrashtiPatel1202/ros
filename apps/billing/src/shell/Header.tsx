import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { api, type BillingSession } from "../api"
import { EXPLORE_PRODUCTS, PRODUCT_SWITCHER } from "../nav"

export function Header({
  session,
  onOpenAi,
  onOpenDeviceMap,
  onSignOut,
}: {
  session: BillingSession
  onOpenAi: () => void
  onOpenDeviceMap: () => void
  onSignOut: () => void
}) {
  const [exploreOpen, setExploreOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
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

  const initial = session.adminName.slice(0, 1).toUpperCase()

  return (
    <header className="ps-header ps-header-new navbar navbar-expand-md sticky-top navbar-light bg-light menu-div">
      <div className="outlet-switch position-relative">
        <button type="button" className="btn btn-link p-0 text-decoration-none text-dark" onClick={() => setSwitcherOpen((v) => !v)}>
          <i className="bi bi-shop me-1" />
          {session.outlet.name}
          <small className="ms-2">{session.outlet.brandCount} brands</small>
        </button>
        {switcherOpen && (
          <div className="dropdown-menu show mt-2" style={{ display: "block", minWidth: 220 }}>
            {PRODUCT_SWITCHER.map((item) => (
              <Link key={item.path} className="dropdown-item" to={item.path} onClick={() => setSwitcherOpen(false)}>
                {item.label}
              </Link>
            ))}
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
            <i className="bi bi-compass" /> Explore Products
          </button>
          {exploreOpen && (
            <div className="mega-menu">
              {(Object.keys(EXPLORE_PRODUCTS) as (keyof typeof EXPLORE_PRODUCTS)[]).map((section) => (
                <div key={section}>
                  <h6>{section}</h6>
                  {EXPLORE_PRODUCTS[section].map((item) => (
                    <Link
                      key={item.path}
                      className="mega-item"
                      to={item.path}
                      onClick={() => setExploreOpen(false)}
                    >
                      <strong>{item.label}</strong>
                      {"desc" in item && item.desc ? <small>{item.desc}</small> : null}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn-explore" onClick={onOpenAi}>
          <i className="bi bi-stars" /> AI Agent
        </button>
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
              <Link className="dropdown-item" to="/users/terms" onClick={() => setProfileOpen(false)}>
                Terms & Conditions
              </Link>
              <Link className="dropdown-item" to="/users/privacy" onClick={() => setProfileOpen(false)}>
                Privacy Policy
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
