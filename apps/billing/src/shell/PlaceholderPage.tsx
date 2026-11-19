import { titleForPath } from "../nav"

export function PlaceholderPage({ pathname }: { pathname: string }) {
  const title = titleForPath(pathname)
  return (
    <div className="placeholder-page">
      <div className="breadcrumb-pp">{title}</div>
      <h1 className="page-title">{title}</h1>
      <div className="pp-card">
        <div className="empty-soft">
          <p className="mb-2 fw-semibold">{title}</p>
          <p className="mb-0">
            This screen is not ready yet.
          </p>
        </div>
      </div>
    </div>
  )
}
