import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { competitions } from '../data'
import {
  ArrowLeft,
  Chevron,
  Fire,
  Play,
  PlayBadge,
  Star,
  Trophy,
  Users,
} from '../ui'
import { EmptyState, NoNetworkArt } from '../components/EmptyState'
import { useOnline } from '../hooks/useOnline'

// Treat the most-joined contests as the ones streaming live right now, and
// derive stable "watching now" counts from their data.
const livePool = [...competitions]
  .sort((a, b) => b.joined - a.joined)
  .slice(0, 14)
  .map((c, i) => ({
    ...c,
    viewers: 400 + ((c.joined * 7 + i * 137) % 3200),
  }))

const FILTERS = ['All', 'Dance', 'Music', 'Coding', 'Art', 'Cooking'] as const

function viewersLabel(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

export default function LivePage() {
  const navigate = useNavigate()
  const online = useOnline()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  // Force a re-render on retry so navigator.onLine is re-read.
  const [, setRetry] = useState(0)

  const list = useMemo(
    () =>
      filter === 'All'
        ? livePool
        : livePool.filter((c) => c.tag === filter),
    [filter],
  )
  const [hero, ...rest] = list

  const totalViewers = livePool.reduce((s, c) => s + c.viewers, 0)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-ink"
        >
          <ArrowLeft />
          <span className="flex items-center gap-2">
            <span className="font-extrabold text-lg leading-tight">
              Live now
            </span>
            <span className="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {livePool.length}
            </span>
          </span>
        </button>
        <span className="flex items-center gap-1 text-xs text-slate font-semibold">
          <Users /> {viewersLabel(totalViewers)} watching
        </span>
      </div>

      {!online ? (
        <EmptyState
          className="flex-1"
          illustration={<NoNetworkArt />}
          title="Can't load live streams"
          message="Live competitions need an internet connection. Reconnect to jump back into the action."
          primary={{ label: 'Retry', onClick: () => setRetry((n) => n + 1) }}
          secondary={{ label: 'Back to home', onClick: () => navigate('/') }}
        />
      ) : (
      <>
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 pt-2 pb-3">
        {FILTERS.map((f) => {
          const active = f === filter
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-ink text-white'
                  : 'bg-white ring-1 ring-neutral-200 text-slate'
              }`}
            >
              {f}
            </button>
          )
        })}
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 space-y-5"
        data-scroll
      >
        {list.length === 0 && (
          <div className="text-center py-16 text-sm text-slate">
            No live competitions in {filter} right now.
          </div>
        )}

        {/* Featured live stream */}
        {hero && (
          <button
            onClick={() => navigate(`/competitions/${hero.id}`)}
            className="relative block w-full overflow-hidden rounded-3xl text-left shadow-lg active:scale-[0.99] transition"
          >
            <img
              src={hero.img}
              alt={hero.title}
              className="w-full h-52 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/10" />
            <div className="absolute inset-x-4 top-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <Users /> {viewersLabel(hero.viewers)} watching
              </span>
            </div>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-14 h-14 rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/40">
              <span className="text-white">
                <PlayBadge />
              </span>
            </span>
            <div className="absolute left-4 right-4 bottom-4 text-white">
              <span className="inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold">
                <Fire className="w-3.5 h-3.5" /> {hero.tag}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                {hero.title}
              </h2>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                  <Trophy className="w-3.5 h-3.5" /> {hero.prize}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-rose-600 shadow-sm">
                  <Play /> Watch
                </span>
              </div>
            </div>
          </button>
        )}

        {/* Live list */}
        {rest.length > 0 && (
          <section>
            <h2 className="font-bold text-ink mb-3">More live rooms</h2>
            <div className="space-y-3">
              {rest.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/competitions/${c.id}`)}
                  className="w-full text-left active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                    <div className="relative shrink-0">
                      <img
                        src={c.img}
                        alt={c.title}
                        className="w-16 h-16 rounded-xl object-cover bg-mint"
                      />
                      <span className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                      <span className="absolute inset-0 m-auto w-7 h-7 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white">
                        <Play />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink text-sm leading-tight truncate">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate mt-0.5 truncate">
                        {c.tag} · {c.host}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                        <span className="flex items-center gap-1 text-rose-500 font-semibold">
                          <Users /> {viewersLabel(c.viewers)} watching
                        </span>
                        <span className="flex items-center gap-1 text-slate">
                          <Star className="w-3 h-3 text-amber-400" /> {c.rating}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate">Prize</p>
                      <p className="text-teal font-extrabold">{c.prize}</p>
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-rose-500">
                        Join <Chevron className="-rotate-90 w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      </>
      )}

      <BottomNav />
    </>
  )
}
