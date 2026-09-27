import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { mySubmissions } from '../data'
import type { Submission, SubmissionStatus } from '../data'
import {
  ArrowLeft,
  Camera,
  Chat,
  CheckCircle,
  Chevron,
  Clock,
  Play,
  Trophy,
  Upload,
} from '../ui'
import { EmptyState, NoEntriesArt } from '../components/EmptyState'

const FILTERS = ['All', 'In review', 'Judged', 'Won'] as const
type Filter = (typeof FILTERS)[number]

const statusStyle: Record<SubmissionStatus, string> = {
  Won: 'bg-amber-50 text-amber-600',
  Judged: 'bg-mint text-teal',
  'In review': 'bg-indigo-50 text-indigo-500',
  'Not selected': 'bg-neutral-100 text-slate',
}

function kindIcon(kind: Submission['kind']) {
  switch (kind) {
    case 'Video':
      return <Play />
    case 'Photo':
      return <Camera />
    case 'Audio':
      return <Chat />
    case 'Writing':
      return <Upload />
    default:
      return <Chevron className="-rotate-90 w-4 h-4" />
  }
}

export default function MySubmissionsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('All')
  const [sheet, setSheet] = useState<Submission | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2000)
  }

  const stats = useMemo(() => {
    const wins = mySubmissions.filter((s) => s.status === 'Won')
    const winnings = wins.reduce(
      (sum, s) => sum + Number((s.prize ?? '').replace(/[^0-9]/g, '')),
      0,
    )
    return {
      entries: mySubmissions.length,
      wins: wins.length,
      inReview: mySubmissions.filter((s) => s.status === 'In review').length,
      winnings,
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: mySubmissions.length, 'In review': 0, Judged: 0, Won: 0 }
    for (const s of mySubmissions) {
      if (s.status === 'In review') c['In review']++
      else if (s.status === 'Judged') c.Judged++
      else if (s.status === 'Won') c.Won++
    }
    return c
  }, [])

  const list = useMemo(
    () =>
      filter === 'All'
        ? mySubmissions
        : mySubmissions.filter((s) => s.status === filter),
    [filter],
  )

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-ink active:scale-95 transition"
        >
          <ArrowLeft />
        </button>
        <div>
          <p className="text-slate text-xs">Everything you've entered</p>
          <h1 className="text-xl font-extrabold text-ink leading-tight">
            My Submissions
          </h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28"
        data-scroll
      >
        {/* Summary strip */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal to-teal-dark text-white p-4 shadow-sm">
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2 text-white/85">
            <Trophy className="w-4 h-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              Total winnings
            </p>
          </div>
          <p className="relative mt-1 text-3xl font-extrabold">
            ₹ {stats.winnings.toLocaleString('en-IN')}
          </p>
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Entries', value: stats.entries },
              { label: 'Wins', value: stats.wins },
              { label: 'In review', value: stats.inReview },
            ].map((s, i, arr) => (
              <div
                key={s.label}
                className={`text-center ${
                  i < arr.length - 1 ? 'border-r border-white/20' : ''
                }`}
              >
                <p className="text-lg font-extrabold leading-none">{s.value}</p>
                <p className="text-[11px] text-white/75 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-1 px-1">
          {FILTERS.map((f) => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-white ring-1 ring-neutral-200 text-slate'
                }`}
              >
                {f}
                <span
                  className={`ml-1.5 ${active ? 'text-white/80' : 'text-slate/70'}`}
                >
                  {counts[f]}
                </span>
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {list.map((s) => (
            <div
              key={s.comp.id}
              className="rounded-2xl bg-white shadow-sm overflow-hidden"
            >
              <button
                onClick={() => navigate(`/competitions/${s.comp.id}`)}
                className="flex items-start gap-3 w-full p-3 text-left active:bg-neutral-50 transition"
              >
                <div className="relative shrink-0">
                  <img
                    src={s.comp.img}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover bg-mint"
                  />
                  <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white shadow ring-1 ring-neutral-100 text-teal flex items-center justify-center [&_svg]:w-3.5 [&_svg]:h-3.5">
                    {kindIcon(s.kind)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink text-sm leading-tight truncate">
                      {s.comp.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusStyle[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate mt-0.5">
                    {s.comp.tag} · {s.kind}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-slate mt-1.5">
                    <Clock /> Submitted {s.submittedOn}
                  </p>
                </div>
              </button>

              {/* Won banner */}
              {s.status === 'Won' && (
                <div className="flex items-center justify-between bg-amber-50 px-3.5 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                    <Trophy className="w-4 h-4" /> {s.place}
                  </span>
                  <span className="text-sm font-extrabold text-amber-700">
                    {s.prize}
                  </span>
                </div>
              )}

              {/* In-review manage row */}
              {s.status === 'In review' && (
                <div className="flex items-center justify-between border-t border-neutral-100 px-3.5 py-2">
                  <span className="text-[11px] text-slate">
                    You can edit before judging opens
                  </span>
                  <button
                    onClick={() => setSheet(s)}
                    className="text-xs font-bold text-teal"
                  >
                    Manage
                  </button>
                </div>
              )}
            </div>
          ))}

          {list.length === 0 && (
            <EmptyState
              className="py-14"
              illustration={<NoEntriesArt />}
              title={
                filter === 'All' ? 'No entries yet' : `Nothing ${filter.toLowerCase()}`
              }
              message={
                filter === 'All'
                  ? 'Enter your first competition and your submissions will show up here.'
                  : `You have no ${filter.toLowerCase()} entries right now. Try a different filter.`
              }
              primary={
                filter === 'All'
                  ? { label: 'Find a competition', onClick: () => navigate('/explore') }
                  : { label: 'Show all entries', onClick: () => setFilter('All') }
              }
            />
          )}
        </div>
      </div>

      {/* Manage submission sheet */}
      <div
        className={`fixed inset-0 z-[60] flex items-end justify-center ${
          sheet ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          onClick={() => setSheet(null)}
          className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
            sheet ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl transition-transform duration-300 ease-out ${
            sheet ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
          {sheet && (
            <>
              <div className="flex items-center gap-3 mt-4">
                <img
                  src={sheet.comp.img}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover bg-mint"
                />
                <div className="min-w-0">
                  <p className="font-extrabold text-ink text-sm truncate">
                    {sheet.comp.title}
                  </p>
                  <p className="text-xs text-slate">Submitted {sheet.submittedOn}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <button
                  onClick={() => {
                    setSheet(null)
                    showToast('Ready to replace your file')
                  }}
                  className="flex items-center gap-3 w-full rounded-xl bg-white ring-1 ring-neutral-200 px-4 py-3 text-left active:scale-[0.99] transition"
                >
                  <span className="w-9 h-9 rounded-lg bg-mint text-teal flex items-center justify-center">
                    <Upload />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">Replace submission</p>
                    <p className="text-[11px] text-slate">Upload a new version</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setSheet(null)
                    navigate(`/competitions/${sheet.comp.id}`)
                  }}
                  className="flex items-center gap-3 w-full rounded-xl bg-white ring-1 ring-neutral-200 px-4 py-3 text-left active:scale-[0.99] transition"
                >
                  <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">View competition</p>
                    <p className="text-[11px] text-slate">Rules, dates & prizes</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setSheet(null)
                    showToast('Entry withdrawn')
                  }}
                  className="w-full rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-500 active:scale-[0.99] transition"
                >
                  Withdraw entry
                </button>
              </div>
            </>
          )}
        </div>
      </div>

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
