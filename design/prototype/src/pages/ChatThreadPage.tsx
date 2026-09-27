import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Send, Shield } from '../ui'
import { threads as THREADS, conversations as CONVERSATIONS, type Msg, type Thread } from '../messages'

export default function ChatThreadPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const thread = THREADS.find((t) => t.id === id) as Thread | undefined
  const base = CONVERSATIONS[id]

  const [messages, setMessages] = useState<Msg[]>(base?.messages ?? [])
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (!thread || !base) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm font-bold text-ink">Conversation not found</p>
        <button
          onClick={() => navigate('/messages')}
          className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to messages
        </button>
      </div>
    )
  }

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        fromMe: true,
        text,
        time: 'Now',
      },
    ])
    setDraft('')
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 pt-4 pb-3">
        <button onClick={() => navigate(-1)} className="text-ink shrink-0">
          <ArrowLeft />
        </button>
        <span className="relative shrink-0">
          <img
            src={thread.avatar}
            alt={thread.name}
            className="h-10 w-10 rounded-full object-cover"
          />
          {thread.online && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-teal ring-2 ring-white" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{thread.name}</p>
          <p className="text-[11px] text-slate">
            {thread.online ? 'Active now' : thread.context}
          </p>
        </div>
        {thread.role === 'judge' && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-mint px-2 py-1 text-[10px] font-semibold text-teal">
            <span className="[&_svg]:h-2.5 [&_svg]:w-2.5">
              <Shield />
            </span>
            Judge
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar bg-canvas px-4 py-4"
        data-scroll
      >
        <p className="mx-auto mb-4 w-fit rounded-full bg-white px-3 py-1 text-[10px] font-medium text-slate shadow-sm">
          {base.meta.note}
        </p>

        <div className="space-y-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.fromMe
                    ? 'rounded-br-md bg-teal text-white'
                    : 'rounded-bl-md bg-white text-ink'
                }`}
              >
                <p>{m.text}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    m.fromMe ? 'text-white/70' : 'text-slate'
                  }`}
                >
                  {m.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-100 bg-white px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
            placeholder={`Message ${thread.name.split(' ')[0]}`}
            className="flex-1 rounded-full bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-white shadow-sm transition active:scale-95 disabled:opacity-40"
          >
            <Send />
          </button>
        </div>
      </div>
    </>
  )
}
