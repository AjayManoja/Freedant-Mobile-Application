import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { getCompetition, getLeaderboard } from '../data'
import type { LeaderboardEntry } from '../data'
import {
  ArrowLeft,
  Chevron,
  SearchIcon,
  Star,
  Trophy,
  Users,
} from '../ui'

type Mode = 'live' | 'final'

// Small up/down/steady indicator for rank movement in the live view.
function Delta({ value }: { value: number }) {
  if (value === 0)
    return <span className="text-[11px] font-bold text-slate/60">—</span>
  const up = value > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        up ? 'text-teal' : 'text-rose-500'
      }`}
    >
      <Chevron
        className={`w-3 h-3 ${up ? 'rotate-180' : ''}`}
      />
      {Math.abs(value)}
    </span>
  )
}

const podiumStyle = [
  { ring: 'ring-amber-300', badge: 'bg-amber-400', pedestal: 'h-20', size: 'w-20 h-20' },
  { ring: 'ring-slate-300', badge: 'bg-slate-400', pedestal: 'h-14', size: 'w-16 h-16' },
  { ring: 'ring-orange-300', badge: 'bg-orange-400', pedestal: 'h-10', size: 'w-16 h-16' },
]

function Podium({
  top,
  mode,
  onOpen,
}: {
  top: LeaderboardEntry[]
  mode: Mode
  onOpen: (e: LeaderboardEntry) => void
}) {
  // Visual order: 2nd, 1st, 3rd so the champion sits centre-stage.
  const order = [top[1], top[0], top[2]].filter(Boolean)
  const rankToStyle = (rank: number) => podiumStyle[rank - 1] ?? podiumStyle[2]
  return (
    <div className="flex items-end justify-center gap-3 px-2">
      {order.map((e) => {
        const st = rankToStyle(e.rank)
        const champion = e.rank === 1
        return (
          <button
            key={e.name}
            onClick={() => onOpen(e)}
            className="flex flex-1 max-w-[110px] flex-col items-center active:scale-[0.98] transition"
          >
            {champion && (
              <span className="mb-1 text-amber-400 [&_svg]:w-6 [&_svg]:h-6">
                <Trophy className="w-6 h-6" />
              </span>
            )}
            <span className="relative">
              <img
                src={e.avatar}
                alt={e.name}
                className={`${st.size} rounded-full object-cover bg-mint ring-4 ${st.ring} ring-offset-2 ring-offset-canvas`}
              />
              <span
                className={`absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full ${st.badge} text-[11px] font-extrabold text-white ring-2 ring-canvas`}
              >
                {e.rank}
              </span>
            </span>
            <p className="mt-2.5 w-full truncate text-center text-[13px] font-bold text-ink">
              {e.isYou ? 'You' : e.name}
            </p>
            {mode === 'final' && e.prize ? (
              <p className="text-[11px] font-bold text-teal">{e.prize}</p>
            ) : (
              <p className="text-[11px] font-semibold text-slate">
                {e.score} pts
              </p>
            )}
            <div
              className={`mt-2 w-full rounded-t-xl bg-gradient-to-b ${
                champion
                  ? 'from-teal to-teal-dark'
                  : 'from-neutral-200 to-neutral-100'
              } ${st.pedestal}`}
            />
          </button>
        )
      })}
    </div>
  )
}

function Row({
  e,
  mode,
  onOpen,
}: {
  e: LeaderboardEntry
  mode: Mode
  onOpen: (e: LeaderboardEntry) => void
}) {
  const medal =
    e.rank <= 3
      ? ['text-amber-400', 'text-slate-400', 'text-orange-400'][e.rank - 1]
      : ''
  return (
    <button
      onClick={() => onOpen(e)}
      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left shadow-sm transition active:scale-[0.99] ${
        e.isYou ? 'bg-mint ring-2 ring-teal' : 'bg-white'
      }`}
    >
      <span
        className={`w-6 shrink-0 text-center text-sm font-extrabold tabular-nums ${
          medal || 'text-slate'
        }`}
      >
        {e.rank}
      </span>
      <img
        src={e.avatar}
        alt={e.name}
        className="w-11 h-11 rounded-xl object-cover bg-mint shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink truncate">
          {e.isYou ? 'You' : e.name}
          {e.isYou && (
            <span className="rounded-full bg-teal px-1.5 py-0.5 text-[9px] font-extrabold text-white">
              YOU
            </span>
          )}
        </p>
        {mode === 'final' && e.place ? (
          <p className="text-[11px] font-semibold text-teal truncate">
            {e.place} · {e.prize}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[11px] text-slate truncate">
            <Users /> {e.votes.toLocaleString('en-IN')} votes · {e.kind}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-extrabold text-ink tabular-nums leading-none">
          {e.score}
          <span className="text-[10px] font-semibold text-slate"> pts</span>
        </p>
        <div className="mt-1 flex items-center justify-end">
          {mode === 'live' ? (
            <Delta value={e.delta} />
          ) : (
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-500">
              <Star className="w-3 h-3" /> {(e.score / 20).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const comp = getCompetition(id)

  // A live contest still ends in the future; a "d/h" that starts with 0 is
  // treated as effectively over so its leaderboard defaults to final results.
  const isRunning = !comp.endsIn.match(/^0\d?h/)
  const [mode, setMode] = useState<Mode>(isRunning ? 'live' : 'final')
  const [query, setQuery] = useState('')

  const [entries, setEntries] = useState<LeaderboardEntry[]>(() =>
    getLeaderboard(comp).map((e) => ({ ...e })),
  )
  const [pulse, setPulse] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset whenever the competition changes.
  useEffect(() => {
    setEntries(getLeaderboard(comp).map((e) => ({ ...e })))
    setMode(isRunning ? 'live' : 'final')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.id])

  // Live simulation: nudge a few scores every few seconds, re-rank, and record
  // the movement so the standings feel genuinely live.
  useEffect(() => {
    if (mode !== 'live') return
    timer.current = setInterval(() => {
      setEntries((prev) => {
        const prevRank = new Map(prev.map((e) => [e.name, e.rank]))
        const next = prev.map((e) => {
          const bump = Math.random() < 0.4 ? Math.round((Math.random() - 0.4) * 4) : 0
          return { ...e, score: Math.max(55, Math.min(99, e.score + bump)) }
        })
        next.sort((a, b) => b.score - a.score || b.votes - a.votes)
        next.forEach((e, i) => {
          e.rank = i + 1
          const was = prevRank.get(e.name) ?? e.rank
          e.delta = was - e.rank
          if (Math.random() < 0.5) e.votes += Math.floor(Math.random() * 6)
        })
        return next
      })
      setPulse(true)
      setTimeout(() => setPulse(false), 600)
    }, 3200)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [mode])

  const you = entries.find((e) => e.isYou)
  const top3 = useMemo(() => entries.slice(0, 3), [entries])
  const rest = useMemo(() => entries.slice(3), [entries])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rest
    return rest.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.handle.includes(q),
    )
  }, [rest, query])

  const openEntrant = (e: LeaderboardEntry) => {
    if (e.isYou) {
      navigate('/profile')
    } else {
      navigate(`/winners/${encodeURIComponent(e.name)}?from=${comp.id}`)
    }
  }

  return (
    <>
      {/* Hero */}
      <div className="relative h-40 shrink-0">
        <img
          src={comp.img}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/45 to-canvas" />
        <div className="relative flex items-center justify-between px-5 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 font-bold text-lg text-white drop-shadow"
          >
            <ArrowLeft />
            Back
          </button>
          {mode === 'live' && (
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              LIVE
            </span>
          )}
        </div>
        <div className="relative mt-3 px-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {mode === 'live' ? 'Live standings' : 'Final results'}
          </p>
          <h1 className="text-xl font-extrabold leading-tight drop-shadow">
            {comp.title}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40" data-scroll>
        {/* Mode toggle */}
        <div className="mt-3 flex rounded-full bg-white p-1 shadow-sm">
          {(['live', 'final'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                mode === m ? 'bg-teal text-white shadow-sm' : 'text-slate'
              }`}
            >
              {m === 'live' ? 'Live standings' : 'Final results'}
            </button>
          ))}
        </div>

        {/* Meta strip */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {[
            { label: 'Entrants', value: comp.joined.toLocaleString('en-IN'), icon: <Users /> },
            { label: 'Prize pool', value: comp.prize, icon: <Trophy className="w-4 h-4" /> },
            {
              label: mode === 'live' ? 'Results in' : 'Announced',
              value: mode === 'live' ? comp.endsIn : 'Final',
              icon: <Star className="w-4 h-4" />,
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-teal">
                {s.icon}
              </span>
              <p className="mt-1.5 truncate text-sm font-extrabold text-ink leading-none">
                {s.value}
              </p>
              <p className="mt-1 text-[10px] text-slate">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Podium */}
        <div className="mt-5">
          <Podium top={top3} mode={mode} onOpen={openEntrant} />
        </div>

        {mode === 'live' && (
          <p className="mt-4 text-center text-[11px] font-medium text-slate">
            <span
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-teal align-middle transition-opacity ${
                pulse ? 'opacity-100' : 'opacity-30'
              }`}
            />
            Standings update live as votes and scores come in
          </p>
        )}

        {/* Search */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm">
          <span className="text-slate">
            <SearchIcon className="w-5 h-5" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search participants…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-slate focus:outline-none"
          />
        </div>

        {/* Full ranking */}
        <div className="mt-3 space-y-2.5">
          {filtered.map((e) => (
            <Row key={e.name} e={e} mode={mode} onOpen={openEntrant} />
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate">
              No participants match “{query}”.
            </p>
          )}
        </div>
      </div>

      {/* Sticky "your rank" bar */}
      {you && (
        <div className="fixed bottom-[76px] left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 px-4">
          <button
            onClick={() => navigate('/profile')}
            className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-white shadow-[0_12px_32px_-8px_rgba(27,43,58,0.5)] active:scale-[0.99] transition"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-extrabold tabular-nums">
              {you.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Your rank</p>
              <p className="text-[11px] text-white/70">
                {mode === 'final' && you.prize
                  ? `${you.place} · ${you.prize}`
                  : `${you.score} pts`}
              </p>
            </div>
            {mode === 'live' && <Delta value={you.delta} />}
            <span className="text-white/70">
              <Chevron className="-rotate-90 w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      <BottomNav />
    </>
  )
}
