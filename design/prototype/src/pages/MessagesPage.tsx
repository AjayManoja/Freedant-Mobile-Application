import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { ArrowLeft, SearchIcon, Shield, Megaphone, userImg } from '../ui'
import { threads as THREADS, type Thread } from '../messages'

const FILTERS = ['All', 'Judges', 'Hosts'] as const

const roleBadge: Record<Thread['role'], { label: string; className: string; icon?: boolean }> = {
  judge: { label: 'Judge', className: 'bg-mint text-teal', icon: true },
  host: { label: 'Host', className: 'bg-indigo-50 text-indigo-500' },
  creator: { label: 'Creator', className: 'bg-amber-50 text-amber-600' },
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  const threads = useMemo(() => {
    return THREADS.filter((t) => {
      if (filter === 'Judges' && t.role !== 'judge') return false
      if (filter === 'Hosts' && t.role !== 'host') return false
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [filter, query])

  const totalUnread = THREADS.reduce((n, t) => n + t.unread, 0)

  return (
    <>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-ink font-bold text-lg"
          >
            <ArrowLeft />
            Messages
          </button>
          <img
            src={userImg}
            alt="You"
            className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        </div>
        {totalUnread > 0 && (
          <p className="mt-1 text-xs text-slate">
            {totalUnread} unread from judges &amp; hosts
          </p>
        )}

        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm">
          <span className="text-slate">
            <SearchIcon className="w-4 h-4" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-slate focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? 'bg-teal text-white shadow-sm'
                  : 'bg-white text-slate'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 pt-1"
        data-scroll
      >
        {threads.length === 0 ? (
          <div className="mt-24 flex flex-col items-center gap-2 text-center px-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-teal">
              <Megaphone className="w-6 h-6" />
            </span>
            <p className="text-sm font-bold text-ink">No conversations yet</p>
            <p className="text-xs text-slate">
              Messages from judges and hosts will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-2xl bg-white shadow-sm">
            {threads.map((t) => {
              const badge = roleBadge[t.role]
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/messages/${t.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-canvas transition"
                >
                  <span className="relative shrink-0">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    {t.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-teal ring-2 ring-white" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-ink">
                        {t.name}
                      </p>
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.icon && (
                          <span className="[&_svg]:h-2.5 [&_svg]:w-2.5">
                            <Shield />
                          </span>
                        )}
                        {badge.label}
                      </span>
                    </div>
                    <p
                      className={`truncate text-xs mt-0.5 ${
                        t.unread ? 'text-ink font-semibold' : 'text-slate'
                      }`}
                    >
                      {t.preview}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-slate">{t.time}</span>
                    {t.unread > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1.5 text-[10px] font-bold text-white">
                        {t.unread}
                      </span>
                    ) : (
                      <span className="h-5" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </>
  )
}
