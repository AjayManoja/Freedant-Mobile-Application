import { useEffect, useState } from 'react'
import { Trophy } from '../ui'

/* Branded launch screen shown while the app "boots". Renders as a full-screen
   overlay on top of the router, plays a short entrance, then fades out and
   calls onFinish so the app underneath is revealed. */
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Hold the brand moment, then start the exit transition.
    const hold = setTimeout(() => setLeaving(true), 1900)
    // Unmount after the fade-out completes.
    const done = setTimeout(onFinish, 2400)
    return () => {
      clearTimeout(hold)
      clearTimeout(done)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-[100] flex justify-center bg-canvas transition-opacity duration-500 ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative w-full max-w-[430px] overflow-hidden bg-gradient-to-b from-teal to-teal-dark text-white flex flex-col items-center justify-center">
        {/* Ambient glows */}
        <span className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-black/10 blur-3xl" />

        {/* Logo + wordmark */}
        <div className="relative flex flex-col items-center">
          <span className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-white shadow-2xl splash-pop">
            {/* pulsing ring */}
            <span className="absolute inset-0 rounded-[28px] ring-4 ring-white/40 animate-ping" />
            <span className="text-teal [&_svg]:h-12 [&_svg]:w-12">
              <Trophy className="h-12 w-12" />
            </span>
          </span>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight splash-rise">
            Feedants
          </h1>
          <p className="mt-2 text-sm font-medium text-white/80 splash-rise splash-rise-delay">
            Compete · Create · Win
          </p>
        </div>

        {/* Progress + footer */}
        <div className="absolute bottom-14 flex w-full flex-col items-center gap-4 px-10">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-1/3 rounded-full bg-white splash-loader" />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
            Made in India 🇮🇳
          </p>
        </div>
      </div>
    </div>
  )
}
