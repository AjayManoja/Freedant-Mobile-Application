import type { ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   Reusable empty / offline state. One layout — a bespoke illustration, a tight
   headline, a supporting line and up to two actions — shared across the app so
   every "nothing here" moment feels like the same, designed surface.
--------------------------------------------------------------------------- */

type Action = {
  label: string
  onClick: () => void
}

export function EmptyState({
  illustration,
  title,
  message,
  primary,
  secondary,
  className = '',
}: {
  illustration: ReactNode
  title: string
  message: string
  primary?: Action
  secondary?: Action
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-8 text-center ${className}`}
    >
      <div className="mb-5">{illustration}</div>
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-slate">
        {message}
      </p>
      {(primary || secondary) && (
        <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2.5">
          {primary && (
            <button
              onClick={primary.onClick}
              className="w-full rounded-xl bg-teal py-3 text-sm font-bold text-white shadow-sm active:scale-[0.99] transition"
            >
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              onClick={secondary.onClick}
              className="w-full rounded-xl bg-white py-3 text-sm font-bold text-teal ring-1 ring-teal/20 active:scale-[0.99] transition"
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- illustrations ---------- *
   Each is a self-contained 132px scene: layered mint discs behind a teal
   line-art motif, so the set reads as one family regardless of where it lands.
*/

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Scene({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[132px] w-[132px]">
      {/* soft backdrop */}
      <span className="absolute inset-0 rounded-[36px] bg-mint" />
      <span className="absolute right-3 top-3 h-6 w-6 rounded-full bg-teal/10" />
      <span className="absolute bottom-4 left-4 h-3.5 w-3.5 rounded-full bg-teal/15" />
      <div className="absolute inset-0 flex items-center justify-center text-teal">
        {children}
      </div>
    </div>
  )
}

export function NoResultsArt() {
  return (
    <Scene>
      <svg width="72" height="72" viewBox="0 0 72 72" {...stroke}>
        <circle cx="31" cy="31" r="18" />
        <path d="M44 44l13 13" />
        {/* empty-face inside the lens */}
        <path d="M25 29h.01M37 29h.01" />
        <path d="M26 39c1.6-2 3.3-3 5-3s3.4 1 5 3" />
      </svg>
    </Scene>
  )
}

export function NoNetworkArt() {
  return (
    <Scene>
      <svg width="76" height="76" viewBox="0 0 76 76" {...stroke}>
        {/* wifi arcs */}
        <path d="M18 34a28 28 0 0140 0" />
        <path d="M27 43a16 16 0 0122 0" />
        <path d="M36 52a4 4 0 014 0" />
        <circle cx="38" cy="58" r="1.4" fill="currentColor" stroke="none" />
        {/* slash */}
        <path d="M16 16l44 44" className="text-rose-400" stroke="currentColor" />
      </svg>
    </Scene>
  )
}

export function NoEntriesArt() {
  return (
    <Scene>
      <svg width="74" height="74" viewBox="0 0 74 74" {...stroke}>
        {/* open box */}
        <path d="M14 32l23-11 23 11-23 11-23-11z" />
        <path d="M14 32v18l23 11 23-11V32" />
        <path d="M37 43v18" />
        {/* sparkle rising out */}
        <path d="M37 20V9M31 14l6-5 6 5" className="text-teal" />
      </svg>
    </Scene>
  )
}
