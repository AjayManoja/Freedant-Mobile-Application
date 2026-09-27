import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import {
  getCompetitionDetail,
  getEntrants,
  hostedCompetitions,
} from '../data'
import type { Entrant, HostedCompetition, HostStatus } from '../data'
import {
  ArrowLeft,
  CheckCircle,
  Chevron,
  Megaphone,
  Plus,
  Star,
  Trophy,
  Users,
} from '../ui'

const FILTERS = ['All', 'Live', 'Judging', 'Draft', 'Closed'] as const
type Filter = (typeof FILTERS)[number]

const statusStyle: Record<HostStatus, string> = {
  Live: 'bg-mint text-teal',
  Judging: 'bg-amber-50 text-amber-600',
  Draft: 'bg-neutral-100 text-slate',
  Closed: 'bg-rose-50 text-rose-500',
}

const inr = (n: number) => '₹ ' + n.toLocaleString('en-IN')

export default function MyCompetitionsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('All')

  // Editable lifecycle state, seeded from the source data.
  const [statuses, setStatuses] = useState<Record<string, HostStatus>>(() =>
    Object.fromEntries(hostedCompetitions.map((h) => [h.comp.id, h.status])),
  )
  const [announced, setAnnounced] = useState<Record<string, string[]>>({})

  const [manage, setManage] = useState<{ hc: HostedCompetition; pick: boolean } | null>(null)
  const [confirm, setConfirm] = useState<HostedCompetition | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2000)
  }

  const rows = useMemo(
    () => hostedCompetitions.map((h) => ({ ...h, status: statuses[h.comp.id] })),
    [statuses],
  )

  const overview = useMemo(() => {
    const live = rows.filter((h) => h.status === 'Live').length
    const entries = rows.reduce((s, h) => s + h.entries, 0)
    const revenue = rows.reduce(
      (s, h) => s + Number(h.revenue.replace(/[^0-9]/g, '')),
      0,
    )
    return { live, entries, revenue }
  }, [rows])

  const counts = useMemo(() => {
    const c = { All: rows.length, Live: 0, Judging: 0, Draft: 0, Closed: 0 } as Record<Filter, number>
    for (const h of rows) c[h.status]++
    return c
  }, [rows])

  const list = filter === 'All' ? rows : rows.filter((h) => h.status === filter)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-ink active:scale-95 transition"
          >
            <ArrowLeft />
          </button>
          <div>
            <p className="text-slate text-xs">Host dashboard</p>
            <h1 className="text-xl font-extrabold text-ink leading-tight">
              My Competitions
            </h1>
          </div>
        </div>
        <button
          onClick={() => navigate('/host')}
          className="flex items-center gap-1 rounded-full bg-teal text-white text-xs font-bold pl-2.5 pr-3.5 py-2 shadow-sm active:scale-95 transition [&_svg]:w-4 [&_svg]:h-4"
        >
          <Plus /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28" data-scroll>
        {/* Overview */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Live now', value: String(overview.live), tint: 'bg-mint text-teal', icon: <Megaphone className="w-5 h-5" /> },
            { label: 'Total entries', value: overview.entries.toLocaleString('en-IN'), tint: 'bg-indigo-50 text-indigo-500', icon: <Users /> },
            { label: 'Revenue', value: inr(overview.revenue), tint: 'bg-amber-50 text-amber-600', icon: <Trophy className="w-5 h-5" /> },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white shadow-sm p-3">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.tint}`}>
                {s.icon}
              </span>
              <p className="mt-2 text-base font-extrabold text-ink leading-none truncate">
                {s.value}
              </p>
              <p className="text-[11px] text-slate mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-1 px-1">
          {FILTERS.map((f) => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active ? 'bg-ink text-white shadow-sm' : 'bg-white ring-1 ring-neutral-200 text-slate'
                }`}
              >
                {f}
                <span className={`ml-1.5 ${active ? 'text-white/70' : 'text-slate/70'}`}>
                  {counts[f]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Cards */}
        <div className="mt-4 space-y-3">
          {list.map((hc) => {
            const winners = announced[hc.comp.id]
            return (
              <div key={hc.comp.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="flex items-start gap-3 p-3">
                  <img
                    src={hc.comp.img}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover bg-mint shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ink text-sm leading-tight truncate">
                        {hc.comp.title}
                      </p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusStyle[hc.status]}`}>
                        {hc.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate mt-0.5">
                      {hc.comp.tag} · created {hc.createdOn}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate">
                      <span className="flex items-center gap-1">
                        <Users /> {hc.entries}
                      </span>
                      <span>{hc.views.toLocaleString('en-IN')} views</span>
                      <span className="text-teal font-semibold">{hc.revenue}</span>
                    </div>
                  </div>
                </div>

                {winners && (
                  <div className="flex items-center gap-1.5 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-700">
                    <Trophy className="w-4 h-4" /> Winners announced ·{' '}
                    {winners.join(', ')}
                  </div>
                )}

                {/* Action bar */}
                <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-2.5">
                  {hc.status === 'Draft' ? (
                    <>
                      <button
                        onClick={() => navigate('/host')}
                        className="flex-1 rounded-lg bg-white ring-1 ring-neutral-200 py-2 text-xs font-bold text-ink"
                      >
                        Edit draft
                      </button>
                      <button
                        onClick={() => {
                          setStatuses((s) => ({ ...s, [hc.comp.id]: 'Live' }))
                          showToast('Competition published')
                        }}
                        className="flex-1 rounded-lg bg-teal py-2 text-xs font-bold text-white"
                      >
                        Publish
                      </button>
                    </>
                  ) : hc.status === 'Judging' ? (
                    <>
                      <button
                        onClick={() => setManage({ hc, pick: false })}
                        className="flex-1 rounded-lg bg-white ring-1 ring-neutral-200 py-2 text-xs font-bold text-ink"
                      >
                        View entries
                      </button>
                      <button
                        onClick={() => setManage({ hc, pick: true })}
                        className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-bold text-white"
                      >
                        Pick winners
                      </button>
                    </>
                  ) : hc.status === 'Closed' ? (
                    <>
                      <button
                        onClick={() => setManage({ hc, pick: false })}
                        className="flex-1 rounded-lg bg-white ring-1 ring-neutral-200 py-2 text-xs font-bold text-ink"
                      >
                        View entries
                      </button>
                      <button
                        onClick={() => navigate(`/competitions/${hc.comp.id}/results`)}
                        className="flex-1 rounded-lg bg-white ring-1 ring-neutral-200 py-2 text-xs font-bold text-ink"
                      >
                        Results
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setManage({ hc, pick: false })}
                        className="flex-1 rounded-lg bg-white ring-1 ring-neutral-200 py-2 text-xs font-bold text-ink"
                      >
                        View entries
                      </button>
                      <button
                        onClick={() => navigate('/host')}
                        className="rounded-lg bg-white ring-1 ring-neutral-200 px-3 py-2 text-xs font-bold text-ink"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirm(hc)}
                        className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Entries / pick-winners sheet */}
      {manage && (
        <EntriesSheet
          hc={manage.hc}
          pickMode={manage.pick}
          onClose={() => setManage(null)}
          onAnnounce={(names) => {
            setAnnounced((a) => ({ ...a, [manage.hc.comp.id]: names }))
            setStatuses((s) => ({ ...s, [manage.hc.comp.id]: 'Closed' }))
            setManage(null)
            showToast('Winners announced 🎉')
          }}
        />
      )}

      {/* Close confirm */}
      {confirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-8">
          <div
            onClick={() => setConfirm(null)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-[300px] rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-extrabold text-ink">Close competition?</h3>
            <p className="mt-1 text-sm text-slate">
              “{confirm.comp.title}” will stop accepting entries and move to
              judging.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl bg-neutral-100 py-3 text-sm font-bold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setStatuses((s) => ({ ...s, [confirm.comp.id]: 'Judging' }))
                  setConfirm(null)
                  showToast('Moved to judging')
                }}
                className="flex-1 rounded-xl bg-rose-500 py-3 text-sm font-bold text-white"
              >
                Close it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 bottom-24 z-[80] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            <span className="text-teal-300">
              <CheckCircle />
            </span>
            {toast}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  )
}

function EntriesSheet({
  hc,
  pickMode,
  onClose,
  onAnnounce,
}: {
  hc: HostedCompetition
  pickMode: boolean
  onClose: () => void
  onAnnounce: (names: string[]) => void
}) {
  const entrants = useMemo(() => getEntrants(hc), [hc])
  const maxWinners = useMemo(
    () => getCompetitionDetail(hc.comp).winnerCount,
    [hc],
  )
  const [picked, setPicked] = useState<string[]>([])

  const toggle = (e: Entrant) => {
    setPicked((cur) => {
      if (cur.includes(e.id)) return cur.filter((id) => id !== e.id)
      if (cur.length >= maxWinners) return cur
      return [...cur, e.id]
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-[430px] h-[86vh] flex flex-col rounded-t-3xl bg-canvas shadow-2xl">
        <div className="px-5 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
          <div className="flex items-center justify-between mt-3">
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold text-ink truncate">
                {pickMode ? 'Pick winners' : 'Entries'}
              </h3>
              <p className="text-xs text-slate truncate">
                {hc.comp.title} · {entrants.length} shown
              </p>
            </div>
            <button onClick={onClose} className="text-slate text-sm font-semibold">
              Close
            </button>
          </div>
          {pickMode && (
            <div className="mt-3 rounded-xl bg-mint px-3.5 py-2.5 text-xs text-teal font-semibold">
              Select up to {maxWinners} winners · {picked.length}/{maxWinners}{' '}
              chosen
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-2.5">
          {entrants.map((e, i) => {
            const rank = picked.indexOf(e.id)
            const isPicked = rank >= 0
            return (
              <button
                key={e.id}
                disabled={!pickMode}
                onClick={() => toggle(e)}
                className={`flex items-center gap-3 w-full rounded-2xl bg-white p-3 text-left shadow-sm transition ${
                  pickMode ? 'active:scale-[0.99]' : ''
                } ${isPicked ? 'ring-2 ring-amber-400' : ''}`}
              >
                <div className="relative shrink-0">
                  <img
                    src={e.avatar}
                    alt={e.name}
                    className="w-11 h-11 rounded-xl object-cover bg-mint"
                  />
                  {!pickMode && (
                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-ink text-white text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{e.name}</p>
                  <p className="text-xs text-slate truncate">
                    @{e.handle} · {e.kind}
                  </p>
                  <p className="text-[11px] text-slate mt-0.5">
                    Submitted {e.submittedOn}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="flex items-center gap-1 text-xs font-bold text-ink justify-end">
                    <Star className="w-3.5 h-3.5 text-amber-400" /> {e.rating}
                  </span>
                  {pickMode ? (
                    isPicked ? (
                      <span className="mt-1 inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {rank === 0 ? '1st' : rank === 1 ? '2nd' : rank === 2 ? '3rd' : `${rank + 1}th`}
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex text-[11px] text-slate">
                        Tap to pick
                      </span>
                    )
                  ) : (
                    <span className="mt-1 inline-flex text-slate">
                      <Chevron className="-rotate-90 w-4 h-4" />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {pickMode && (
          <div className="border-t border-neutral-200/70 bg-canvas/90 backdrop-blur px-4 pt-3 pb-6">
            <button
              disabled={picked.length === 0}
              onClick={() =>
                onAnnounce(
                  picked.map(
                    (id) => entrants.find((e) => e.id === id)?.name ?? '',
                  ),
                )
              }
              className={`w-full rounded-xl py-3.5 text-sm font-bold transition ${
                picked.length > 0
                  ? 'bg-teal text-white shadow-sm active:scale-[0.99]'
                  : 'bg-neutral-200 text-slate'
              }`}
            >
              {picked.length > 0
                ? `Announce ${picked.length} winner${picked.length > 1 ? 's' : ''}`
                : 'Select winners to announce'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
