import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { CompetitionRow } from '../components/CompetitionRow'
import { competitions } from '../data'
import { ArrowLeft, Clock, Fire, SearchIcon, Trophy } from '../ui'
import { EmptyState, NoNetworkArt, NoResultsArt } from '../components/EmptyState'
import { useOnline } from '../hooks/useOnline'

const RECENT_KEY = 'feedants_recent_searches'

const SUGGESTED = [
  'Dance',
  'React',
  'Photography',
  'Poetry',
  'Acoustic',
  'Coding',
  'Bollywood',
  'Sketch',
]

type SortKey = 'relevance' | 'prize' | 'ending'

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

const prizeNum = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0
const endsRank = (s: string) => (s.startsWith('0') ? 0 : 1)

export default function SearchPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState(params.get('q') ?? '')
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [sort, setSort] = useState<SortKey>('relevance')

  // Focus the field on mount so the keyboard opens straight away.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keep the URL query param in sync so results are shareable/back-safe.
  useEffect(() => {
    const q = query.trim()
    setParams(q ? { q } : {}, { replace: true })
  }, [query, setParams])

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const results = useMemo(() => {
    if (!searching) return []
    const matched = competitions.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q),
    )
    const sorted = [...matched]
    if (sort === 'prize') sorted.sort((a, b) => prizeNum(b.prize) - prizeNum(a.prize))
    else if (sort === 'ending')
      sorted.sort((a, b) => endsRank(a.endsIn) - endsRank(b.endsIn))
    return sorted
  }, [q, searching, sort])

  // Live-count how many contests match each tag, for the discovery view.
  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of competitions) counts.set(c.tag, (counts.get(c.tag) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [])

  const commit = (term: string) => {
    const t = term.trim()
    if (!t) return
    setQuery(t)
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* storage may be unavailable */
      }
      return next
    })
  }

  const clearRecent = () => {
    setRecent([])
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {/* Search bar header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-ink shrink-0 active:scale-95 transition"
        >
          <ArrowLeft />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            commit(query)
            inputRef.current?.blur()
          }}
          className="flex flex-1 items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-sm"
        >
          <span className="text-slate">
            <SearchIcon className="w-5 h-5" />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search competitions, hosts…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate"
          />
          {searching && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="px-1 text-lg leading-none text-slate"
            >
              ×
            </button>
          )}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28" data-scroll>
        {searching ? (
          <>
            {/* Sort + count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate">
                {results.length} result{results.length === 1 ? '' : 's'} for “
                {query.trim()}”
              </p>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {(
                [
                  { key: 'relevance', label: 'Top match' },
                  { key: 'prize', label: 'Highest prize' },
                  { key: 'ending', label: 'Ending soon' },
                ] as { key: SortKey; label: string }[]
              ).map((s) => {
                const active = sort === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-ink text-white shadow-sm'
                        : 'bg-white ring-1 ring-neutral-200 text-slate'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            {!online ? (
              <EmptyState
                className="py-14"
                illustration={<NoNetworkArt />}
                title="You're offline"
                message="We can't search competitions without a connection. Check your network and try again."
                primary={{ label: 'Try again', onClick: () => setQuery((v) => v) }}
              />
            ) : results.length === 0 ? (
              <EmptyState
                className="py-14"
                illustration={<NoResultsArt />}
                title={`No results for “${query.trim()}”`}
                message="Try another keyword, host or category — or browse what's trending."
                primary={{ label: 'Clear search', onClick: () => setQuery('') }}
                secondary={{ label: 'Explore competitions', onClick: () => navigate('/explore') }}
              />
            ) : (
              <div className="mt-4 space-y-3">
                {results.map((c) => (
                  <CompetitionRow key={c.id} c={c} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Recent searches */}
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-ink">Recent</h2>
                  <button
                    onClick={clearRecent}
                    className="text-xs font-semibold text-teal"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-3 space-y-1">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => commit(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-neutral-100 transition"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-slate">
                        <Clock />
                      </span>
                      <span className="flex-1 truncate text-sm text-ink">{r}</span>
                      <span className="text-slate">
                        <SearchIcon className="w-4 h-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Suggested keywords */}
            <section className="mt-6">
              <h2 className="font-bold text-ink">Suggested</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => commit(s)}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate shadow-sm active:scale-95 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Browse by category */}
            <section className="mt-6">
              <h2 className="font-bold text-ink">Browse categories</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {topTags.map(([tag, count], i) => (
                  <button
                    key={tag}
                    onClick={() => commit(tag)}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm active:scale-[0.98] transition"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        [
                          'bg-mint text-teal',
                          'bg-amber-50 text-amber-500',
                          'bg-rose-50 text-rose-400',
                          'bg-indigo-50 text-indigo-400',
                          'bg-teal/10 text-teal',
                          'bg-neutral-100 text-slate',
                        ][i % 6]
                      }`}
                    >
                      {i % 2 === 0 ? <Fire className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink leading-tight truncate">
                        {tag}
                      </p>
                      <p className="text-[11px] text-slate">{count} contests</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </>
  )
}
