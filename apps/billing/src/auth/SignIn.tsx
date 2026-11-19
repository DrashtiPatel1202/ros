import { useState, type FormEvent } from "react"
import { ApiError, api, type BillingSession } from "../api"
import { APP_NAME } from "../nav"

export function SignIn({ onSignedIn }: { onSignedIn: (session: BillingSession) => void }) {
  const [step, setStep] = useState<"identify" | "password">("identify")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [hint, setHint] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function onIdentify(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const result = await api.identify(identifier.trim())
      setHint(result.maskedHint)
      setStep("password")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not continue.")
    } finally {
      setPending(false)
    }
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      onSignedIn(await api.signIn(identifier.trim(), password))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not sign in.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="signin-page">
      <section className="signin-art">
        <div className="pp-logo-mark"><span>RO</span> {APP_NAME}</div>
        <h1>Welcome!</h1>
        <p>Sign in to access your restaurant account, orders, menu, reports and more.</p>
      </section>
      <section className="signin-card-wrap">
        <div className="signin-card">
          <div className="pp-logo-mark"><span>RO</span> {APP_NAME}</div>
          <h2>Sign In to access Account</h2>
          <p className="lede">
            {step === "identify"
              ? "Enter your email address or mobile number."
              : `Continue as ${hint}`}
          </p>
          {step === "identify" ? (
            <form onSubmit={onIdentify}>
              <label className="form-label">Email address or mobile number</label>
              <input
                className="form-control mb-3"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email address or mobile number"
                autoFocus
                required
              />
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <button className="btn btn-primary w-100" type="submit" disabled={pending}>
                {pending ? "Please wait…" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={onPassword}>
              <label className="form-label">Password</label>
              <input
                className="form-control mb-3"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <button className="btn btn-primary w-100 mb-2" type="submit" disabled={pending}>
                {pending ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                className="btn btn-link w-100"
                onClick={() => {
                  setStep("identify")
                  setPassword("")
                  setError("")
                }}
              >
                Use a different account
              </button>
            </form>
          )}
          <hr className="my-4" />
          <p className="text-muted small mb-0">
            New here? <a href="#contact">Contact Us</a>
          </p>
          <p className="text-muted small mt-2 mb-0">Demo: demo@harbour.kitchen / demo1234</p>
        </div>
      </section>
    </div>
  )
}
