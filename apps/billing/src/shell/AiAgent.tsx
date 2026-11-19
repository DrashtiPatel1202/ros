import { useState } from "react"
import { AI_PROMPTS } from "../nav"

export function AiAgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([])

  if (!open) return null

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed },
      {
        role: "assistant",
        text: "AI Agent is available in the shell (Wave 0/1). Business answers will connect once reporting data and models are wired in later waves.",
      },
    ])
    setInput("")
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="AI Agent">
        <div className="drawer-header">
          <span>AI Agent</span>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <div className="drawer-body">
          <p className="text-muted">Suggested prompts</p>
          <div className="d-flex flex-column gap-2 mb-3">
            {AI_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" className="btn btn-outline-primary btn-sm text-start" onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <div className="d-flex flex-column gap-2 mb-3">
            {messages.map((msg, index) => (
              <div key={index} className={`p-2 rounded ${msg.role === "user" ? "bg-primary-subtle" : "bg-light"}`}>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 border-top d-flex gap-2">
          <input
            className="form-control"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your business"
            onKeyDown={(e) => {
              if (e.key === "Enter") send(input)
            }}
          />
          <button type="button" className="btn btn-primary" onClick={() => send(input)}>
            Send
          </button>
        </div>
      </aside>
    </>
  )
}

export function AiFab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ai-fab" onClick={onClick}>
      <i className="bi bi-stars" /> AI Agent
    </button>
  )
}
