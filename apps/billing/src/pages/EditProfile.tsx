import { useState, type FormEvent } from "react"
import { ApiError, api, type BillingSession } from "../api"

export function EditProfile({
  session,
  onUpdated,
}: {
  session: BillingSession
  onUpdated: (session: BillingSession) => void
}) {
  const [twoFactor, setTwoFactor] = useState(session.twoFactorEnabled)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function save2fa() {
    setPending(true)
    setError("")
    setMessage("")
    try {
      onUpdated(await api.updateProfile({ twoFactorEnabled: twoFactor }))
      setMessage("2FA preference saved.")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save.")
    } finally {
      setPending(false)
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirm) {
      setError("New password and confirm password must match.")
      return
    }
    setPending(true)
    setError("")
    setMessage("")
    try {
      onUpdated(await api.updateProfile({ currentPassword, newPassword }))
      setCurrentPassword("")
      setNewPassword("")
      setConfirm("")
      setMessage("Password updated.")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not update password.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <div className="breadcrumb-pp">Restaurant Order Management › Edit Profile</div>
      <h1 className="page-title">Edit Profile</h1>
      <div className="pp-card">
        <h3 className="mb-3">User Info</h3>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label">Outlet</label>
            <input className="form-control" value={session.outlet.name} disabled />
          </div>
          <div className="col-md-4">
            <label className="form-label">Email</label>
            <input className="form-control" value={session.email} disabled />
          </div>
          <div className="col-md-4">
            <label className="form-label">Name</label>
            <input className="form-control" value={session.adminName} disabled />
          </div>
        </div>

        <h3 className="mb-3">2FA For Login</h3>
        <div className="form-check form-switch mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            checked={twoFactor}
            onChange={(e) => setTwoFactor(e.target.checked)}
            id="twofa"
          />
          <label className="form-check-label" htmlFor="twofa">
            Enable 2FA for login
          </label>
        </div>
        <button type="button" className="btn btn-primary mb-4" disabled={pending} onClick={() => void save2fa()}>
          Save 2FA
        </button>

        <h3 className="mb-3">Change Password</h3>
        <form onSubmit={changePassword} className="row g-3" style={{ maxWidth: 480 }}>
          <div className="col-12">
            <label className="form-label">Current password</label>
            <input className="form-control" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="col-12">
            <label className="form-label">New password</label>
            <input className="form-control" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="col-12">
            <label className="form-label">Confirm password</label>
            <input className="form-control" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              Update password
            </button>
          </div>
        </form>
        {message && <div className="alert alert-success mt-3 mb-0">{message}</div>}
        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
      </div>
    </div>
  )
}
