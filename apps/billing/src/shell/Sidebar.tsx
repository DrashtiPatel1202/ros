import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { APP_NAME, SIDEBAR, isImplemented, isSubGroup, type NavGroup, type NavLeaf, type NavSubGroup } from "../nav"

const ICONS: Record<string, string> = {
  dashboard: "bi-speedometer2",
  "dynamic-dashboard": "bi-bar-chart-line",
  "pos-billing": "bi-receipt",
  "live-orders": "bi-broadcast",
  "all-orders": "bi-list-ul",
  "online-orders": "bi-globe2",
  "dynamic-reports": "bi-graph-up",
  kot: "bi-printer",
  "menu-mgmt": "bi-grid",
  "menu-images": "bi-images",
  "menu-onoff": "bi-toggles",
  inventory: "bi-box-seam",
  "mkt-auto": "bi-megaphone",
  finance: "bi-wallet2",
  "day-end": "bi-calendar-check",
  "other-reports": "bi-file-earmark-bar-graph",
  "report-noti": "bi-bell",
  "delivery-mgmt": "bi-truck",
  configuration: "bi-sliders",
  accounting: "bi-journal-text",
  "user-mgmt": "bi-people",
  "user-logs": "bi-clock-history",
  explore: "bi-compass",
  audit: "bi-shield-check",
  "device-map": "bi-phone",
  "crm-marketing": "bi-megaphone",
  campaign: "bi-send",
  "google-biz": "bi-google",
  customers: "bi-person-lines-fill",
  feedback: "bi-chat-left-text",
  loyalty: "bi-award",
  "swiggy-help": "bi-shop",
  "outlet-config": "bi-shop",
  "sub-order": "bi-diagram-3",
  "delivery-distance": "bi-signpost",
  "area-charges": "bi-geo-alt",
  "floor-plan": "bi-grid-3x3-gap",
}

function iconFor(id: string) {
  return ICONS[id] ?? "bi-dot"
}

function visibleGroups(groups: NavGroup[]): NavGroup[] {
  const result: NavGroup[] = []
  for (const group of groups) {
    const children: NavGroup["children"] = []
    for (const child of group.children) {
      if (isSubGroup(child)) {
        const leaves = child.children.filter((leaf) => isImplemented(leaf.path))
        if (leaves.length) children.push({ ...child, children: leaves })
      } else if (isImplemented(child.path)) {
        children.push(child)
      }
    }
    if (children.length) result.push({ ...group, children })
  }
  return result
}

function matches(leafPath: string, path: string) {
  if (leafPath === path) return true
  if (leafPath === "/menus/menu_management" && path.startsWith("/menus/")) return true
  if (leafPath === "/inventory_dashboard/new_inventory_dashboard" && path.startsWith("/inventor")) return true
  if (
    leafPath === "/users/res_new/1" &&
    (path.startsWith("/users/res") ||
      path.startsWith("/users/billing_") ||
      path.startsWith("/users/pos_configuration") ||
      path.startsWith("/users/connected_services") ||
      path.startsWith("/users/bill_kot") ||
      path.startsWith("/users/pending_order"))
  ) {
    return true
  }
  return false
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const path = location.pathname.replace(/\/$/, "") || "/"
  const groups = useMemo(() => visibleGroups(SIDEBAR), [])
  const [open, setOpen] = useState<Record<string, boolean>>({ daily: true })

  const activeBranch = useMemo(() => {
    const branch = { group: "", sub: "", leaf: "" }
    for (const group of groups) {
      for (const child of group.children) {
        if (isSubGroup(child)) {
          for (const leaf of child.children) {
            if (matches(leaf.path, path)) {
              branch.group = group.id
              branch.sub = child.id
              branch.leaf = leaf.id
            }
          }
        } else if (matches(child.path, path)) {
          branch.group = group.id
          branch.leaf = child.id
        }
      }
    }
    if (!branch.leaf && path === "/users/dashboard") branch.leaf = "dashboard"
    return branch
  }, [path, groups])

  useEffect(() => {
    setOpen((current) => ({
      ...current,
      ...(activeBranch.group ? { [activeBranch.group]: true } : {}),
      ...(activeBranch.sub ? { [activeBranch.sub]: true } : {}),
    }))
  }, [activeBranch.group, activeBranch.sub])

  function toggle(id: string) {
    setOpen((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <aside className="sidebar sidebar-menu sidebar-new-ps">
      <div className="sidebar-brand">
        {!collapsed && <span className="sidebar-brand-name">{APP_NAME}</span>}
        <button type="button" className="header-icon-btn" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`} />
        </button>
      </div>
      <div className="sidebar-scroll">
        {groups.map((group) => {
          const expanded = !group.collapsible || collapsed || (open[group.id] ?? false)
          return (
            <div key={group.id}>
              {group.label && !collapsed && (
                <button type="button" className={`nav-section ${expanded ? "open" : ""}`} onClick={() => group.collapsible && toggle(group.id)}>
                  <span>{group.label}</span>
                  {group.collapsible && <i className="bi bi-chevron-down" />}
                </button>
              )}
              {expanded &&
                group.children.map((child) => {
                  if (isSubGroup(child)) {
                    return (
                      <SubGroup
                        key={child.id}
                        group={child}
                        collapsed={collapsed}
                        open={collapsed || (open[child.id] ?? false)}
                        active={activeBranch.sub === child.id}
                        activeLeaf={activeBranch.leaf}
                        onToggle={() => toggle(child.id)}
                      />
                    )
                  }
                  return (
                    <NavItem key={child.id} leaf={child} active={activeBranch.leaf === child.id} collapsed={collapsed} />
                  )
                })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function SubGroup({
  group,
  collapsed,
  open,
  active,
  activeLeaf,
  onToggle,
}: {
  group: NavSubGroup
  collapsed: boolean
  open: boolean
  active: boolean
  activeLeaf: string
  onToggle: () => void
}) {
  return (
    <div>
      <button type="button" className={`nav-sub ${open ? "open" : ""} ${active ? "active" : ""}`} title={group.label} onClick={onToggle}>
        <i className={`bi nav-ico ${iconFor(group.id)}`} />
        {!collapsed && (
          <>
            <span className="nav-label">{group.label}</span>
            <i className="bi bi-chevron-down chev" />
          </>
        )}
      </button>
      {open &&
        !collapsed &&
        group.children.map((leaf) => (
          <NavItem key={leaf.id} leaf={leaf} active={activeLeaf === leaf.id} collapsed={false} depth="nested" />
        ))}
    </div>
  )
}

function NavItem({
  leaf,
  active,
  collapsed,
  depth,
}: {
  leaf: NavLeaf
  active: boolean
  collapsed: boolean
  depth?: "child" | "nested"
}) {
  const className = `nav-link-pp ${depth ?? ""} ${active ? "active" : ""}`
  const body = (
    <>
      <i className={`bi nav-ico ${iconFor(leaf.id)}`} />
      {!collapsed && (
        <>
          <span className="nav-label">{leaf.label}</span>
          {leaf.badge && <span className={`nav-badge ${leaf.badge === "Beta" ? "beta" : ""}`}>{leaf.badge}</span>}
        </>
      )}
    </>
  )
  if (leaf.path === "/pos/billing") {
    return (
      <a href="/pos/billing" className={className} title={leaf.label}>
        {body}
      </a>
    )
  }
  return (
    <Link to={leaf.path} className={className} title={leaf.label}>
      {body}
    </Link>
  )
}
