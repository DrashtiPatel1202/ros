import { useState } from "react"
import { ApiError, api, type Session } from "./api"

export function PinScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [digits, setDigits] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(pin: string) {
    setPending(true)
    setError("")
    try {
      onSignedIn(await api.signIn(pin))
    } catch (caught) {
      setDigits("")
      setError(caught instanceof ApiError ? caught.message : "Couldn't sign in. Try again.")
    } finally {
      setPending(false)
    }
  }

  function press(digit: string) {
    if (pending) return
    const next = (digits + digit).slice(0, 4)
    setDigits(next)
    setError("")
    if (next.length === 4) void submit(next)
  }

  return (
    <main className="pin">
      <p className="brand">REA Counter</p>
      <h1>Manager sign in</h1>
      <p className="lede">Enter the 4-digit PIN to take orders.</p>
      <div className="pin-dots" aria-label="PIN">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={digits.length > index ? "filled" : ""} />
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map((key) => (
          <button
            key={key}
            type="button"
            className={key === "⌫" ? "wide" : ""}
            onClick={() => (key === "⌫" ? setDigits((value) => value.slice(0, -1)) : press(key))}
            disabled={pending}
          >
            {key === "⌫" ? "Delete" : key}
          </button>
        ))}
      </div>
      <p className="hint">Demo PIN 1234</p>
    </main>
  )
}
