import { useEffect, useRef, useState } from 'react'
import { useOnline } from '../hooks/useOnline'

/* ---------------------------------------------------------------------------
   App-wide connectivity indicator, scoped to the phone frame. Drops a slim bar
   down from the top the moment the device goes offline, and — once connection
   returns — briefly flips to a teal "Back online" confirmation before retiring.
--------------------------------------------------------------------------- */

export function OfflineBanner() {
  const online = useOnline()
  const [show, setShow] = useState(!online)
  const [reconnected, setReconnected] = useState(false)
  // Remember whether we were ever offline, so the "Back online" flash only
  // fires after a genuine drop — not on first load.
  const wasOffline = useRef(!online)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setReconnected(false)
      setShow(true)
      return
    }
    if (wasOffline.current) {
      // Connection restored — confirm, then slide away.
      setReconnected(true)
      setShow(true)
      const id = setTimeout(() => {
        setShow(false)
        setReconnected(false)
        wasOffline.current = false
      }, 2200)
      return () => clearTimeout(id)
    }
  }, [online])

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none absolute inset-x-0 top-0 z-[90] flex justify-center px-3 pt-3 transition-all duration-300 ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
      }`}
    >
      <div
        className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 ${
          reconnected
            ? 'bg-teal text-white ring-white/20'
            : 'bg-ink text-white ring-white/10'
        }`}
      >
        {reconnected ? (
          <>
            <span className="flex h-2 w-2 rounded-full bg-emerald-300" />
            Back online
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
            </span>
            No internet connection
          </>
        )}
      </div>
    </div>
  )
}
