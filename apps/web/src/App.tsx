import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiError, api, type Session } from "./api"
import { Counter, type Notice } from "./Counter"
import { OrderDetail, Orders } from "./Orders"
import { PinScreen } from "./PinScreen"

type View =
  | { name: "counter" }
  | { name: "orders" }
  | { name: "order"; id: number }
  | { name: "edit"; id: number }

export function App() {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api.session(),
    retry: false,
  })
  const [view, setView] = useState<View>({ name: "counter" })
  const [notice, setNotice] = useState<Notice | null>(null)

  const signOut = useMutation({
    mutationFn: api.signOut,
    onSettled: async () => {
      queryClient.clear()
      await queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  if (session.isLoading) return <p className="boot">Opening the counter…</p>
  if (session.isError) {
    const unauthenticated = session.error instanceof ApiError && session.error.status === 401
    if (!unauthenticated) {
      return (
        <main className="boot">
          <p>The counter can't reach the server.</p>
          <button type="button" onClick={() => session.refetch()}>
            Try again
          </button>
        </main>
      )
    }
    return <PinScreen onSignedIn={(next) => queryClient.setQueryData(["session"], next)} />
  }

  const current = session.data as Session
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="brand">REA Counter</p>
          <p className="outlet">{current.outlet.name}</p>
        </div>
        <nav>
          <button type="button" className={view.name === "counter" || view.name === "edit" ? "on" : ""} onClick={() => setView({ name: "counter" })}>
            Take order
          </button>
          <button type="button" className={view.name === "orders" || view.name === "order" ? "on" : ""} onClick={() => setView({ name: "orders" })}>
            Today's orders
          </button>
        </nav>
        <button type="button" className="ghost" onClick={() => signOut.mutate()}>
          Sign out
        </button>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice.text}</span>
          <button type="button" onClick={() => {
            setNotice(null)
            setView({ name: "order", id: notice.orderId })
          }}>
            View
          </button>
          <button type="button" className="ghost" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
      {view.name === "counter" && (
        <Counter session={current} onSaved={(saved) => {
          setNotice(saved)
          queryClient.invalidateQueries({ queryKey: ["orders"] })
        }} />
      )}
      {view.name === "edit" && (
        <Counter
          session={current}
          editingId={view.id}
          onSaved={(saved) => {
            setNotice(saved)
            queryClient.invalidateQueries({ queryKey: ["orders"] })
            queryClient.invalidateQueries({ queryKey: ["order", view.id] })
            setView({ name: "order", id: view.id })
          }}
          onDiscard={() => setView({ name: "order", id: view.id })}
        />
      )}
      {view.name === "orders" && <Orders timezone={current.outlet.timezone} onOpen={(id) => setView({ name: "order", id })} />}
      {view.name === "order" && (
        <OrderDetail
          id={view.id}
          timezone={current.outlet.timezone}
          onBack={() => setView({ name: "orders" })}
          onEdit={() => setView({ name: "edit", id: view.id })}
        />
      )}
    </div>
  )
}
