import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Chevron, Fire, Megaphone, Star, Trophy, Upload } from '../ui'

type Slide = {
  icon: ReactNode
  accent: string // gradient classes for the illustration panel
  chips: { label: string; className: string }[]
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: <Fire />,
    accent: 'from-teal to-teal-dark',
    chips: [
      { label: '💃 Dance', className: 'top-8 left-6 rotate-[-6deg]' },
      { label: '🎤 Music', className: 'top-16 right-6 rotate-[5deg]' },
      { label: '📷 Photography', className: 'bottom-10 left-10 rotate-[4deg]' },
      { label: '💻 Coding', className: 'bottom-16 right-8 rotate-[-4deg]' },
    ],
    title: 'Discover competitions',
    body: 'Thousands of live contests across dance, music, art, coding and more — refreshed every single day.',
  },
  {
    icon: <Upload />,
    accent: 'from-indigo-400 to-indigo-600',
    chips: [
      { label: '🎬 Upload video', className: 'top-10 left-6 rotate-[-5deg]' },
      { label: '🔗 Paste a link', className: 'top-20 right-6 rotate-[6deg]' },
      { label: '✅ Judged fairly', className: 'bottom-12 left-8 rotate-[3deg]' },
    ],
    title: 'Compete & submit',
    body: 'Join in a single tap, upload your entry and let expert judges review your work.',
  },
  {
    icon: <Trophy />,
    accent: 'from-amber-400 to-orange-500',
    chips: [
      { label: '🏆 Win prizes', className: 'top-8 right-8 rotate-[6deg]' },
      { label: '⭐ Get ranked', className: 'top-20 left-6 rotate-[-5deg]' },
      { label: '📜 Certificates', className: 'bottom-12 right-6 rotate-[4deg]' },
    ],
    title: 'Win & get rewarded',
    body: 'Climb the leaderboard, win real prize money and get recognized on your public winner profile.',
  },
  {
    icon: <Megaphone />,
    accent: 'from-fuchsia-500 to-purple-600',
    chips: [
      { label: '🚀 Launch in minutes', className: 'top-10 left-6 rotate-[-6deg]' },
      { label: '👥 24k+ creators', className: 'top-20 right-6 rotate-[5deg]' },
      { label: '💸 Earn per entry', className: 'bottom-12 left-10 rotate-[4deg]' },
    ],
    title: 'Host your own',
    body: 'Ready to run the show? Launch your own competition and reach 24k+ creators instantly.',
  },
]

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const startX = useRef<number | null>(null)
  const last = i === SLIDES.length - 1

  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)))
  const next = () => (last ? onDone() : go(i + 1))

  const onTouchStart = (e: React.TouchEvent) => (startX.current = e.touches[0].clientX)
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    if (dx < -45) go(i + 1)
    else if (dx > 45) go(i - 1)
    startX.current = null
  }

  return (
    <div className="fixed inset-0 z-[95] flex justify-center bg-canvas">
      <div className="relative flex w-full max-w-[430px] flex-col bg-canvas">
        {/* Skip */}
        <div className="flex justify-end px-5 pt-5">
          <button
            onClick={onDone}
            className={`text-sm font-semibold text-slate transition ${
              last ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            Skip
          </button>
        </div>

        {/* Sliding track */}
        <div
          className="flex-1 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex h-full transition-transform duration-[400ms] ease-out"
            style={{ transform: `translateX(-${i * 100}%)` }}
          >
            {SLIDES.map((s, idx) => (
              <div
                key={idx}
                className="flex h-full w-full shrink-0 flex-col items-center px-8"
              >
                {/* Illustration */}
                <div
                  className={`relative mt-4 flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-[36px] bg-gradient-to-br ${s.accent} text-white shadow-lg`}
                >
                  <span className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                  <span className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-black/10 blur-2xl" />
                  {/* Floating chips */}
                  {s.chips.map((c) => (
                    <span
                      key={c.label}
                      className={`absolute rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-ink shadow-md backdrop-blur-sm ${c.className}`}
                    >
                      {c.label}
                    </span>
                  ))}
                  <span className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-md ring-1 ring-white/40 [&_svg]:!h-14 [&_svg]:!w-14">
                    {s.icon}
                  </span>
                </div>

                {/* Copy */}
                <h2 className="mt-9 text-center text-2xl font-extrabold text-ink">
                  {s.title}
                </h2>
                <p className="mt-2.5 max-w-[300px] text-center text-sm leading-relaxed text-slate">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer: dots + CTA */}
        <div className="px-8 pb-10 pt-2">
          <div className="mb-6 flex items-center justify-center gap-2">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => go(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === i ? 'w-6 bg-teal' : 'w-2 bg-teal/25'
                }`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal py-3.5 text-sm font-extrabold text-white shadow-sm transition active:scale-[0.99]"
          >
            {last ? 'Get started' : 'Next'}
            {!last && <Chevron className="-rotate-90 h-4 w-4" />}
            {last && <Star className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
