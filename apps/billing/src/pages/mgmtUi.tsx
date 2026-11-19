import type { ReactNode } from "react"
import { ApiError } from "../api"

export function MgmtShell({ crumb, title, children }: { crumb: string; title: string; children: ReactNode }) {
  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Management › {crumb}</div>
      <h1 className="page-title">{title}</h1>
      {children}
    </div>
  )
}

export function errText(caught: unknown, fallback: string) {
  return caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : fallback
}

export function rupeesToPaise(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

export function today() {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${m}-${d}`
}

export function when(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}
