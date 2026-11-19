import { useState } from "react"
import { api } from "../api"
import { errText } from "../pages/mgmtUi"

export function DeviceMapModal({
  outletName,
  onClose,
}: {
  outletName: string
  onClose: () => void
}) {
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [syncCode, setSyncCode] = useState<string | null>(null)
  const [error, setError] = useState("")

  return (
    <div className="modal-pp-backdrop" role="dialog">
      <div className="modal-pp">
        <div className="modal-pp-header">
          <span>Map Device With {outletName}</span>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <div className="modal-pp-body">
          {error && <p className="text-danger">{error}</p>}
          <p className="text-muted">
            Enter the mapping code shown on Feedback App, Scan &amp; QR, or Android POS (Bijlipay).
          </p>
          <label className="form-label">Mapping code</label>
          <input className="form-control mb-3" value={code} onChange={(e) => setCode(e.target.value)} />
          <hr />
          <p className="fw-semibold">Or generate a secure sync code</p>
          <label className="form-label">Confirm password</label>
          <input
            className="form-control mb-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {syncCode && <div className="alert alert-success">Sync code: <strong>{syncCode}</strong></div>}
        </div>
        <div className="modal-pp-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={password.length < 4}
            onClick={() => {
              setError("")
              void api
                .syncCode({ password, name: "Billing terminal", kind: "billing" })
                .then((result) => setSyncCode(result.mappingCode))
                .catch((caught) => setError(errText(caught, "Could not issue a code")))
            }}
          >
            Get Code
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!code.trim()}
            onClick={() => {
              setError("")
              void api
                .pairDevice({ code })
                .then(() => onClose())
                .catch((caught) => setError(errText(caught, "Could not map the device")))
            }}
          >
            Map Device
          </button>
        </div>
      </div>
    </div>
  )
}
