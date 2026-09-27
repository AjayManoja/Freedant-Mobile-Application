import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { CompetitionRow } from '../components/CompetitionRow'
import { competitions } from '../data'
import {
  Bell,
  Card,
  Fire,
  SearchIcon,
  SectionHeader,
  Star,
  Trophy,
  Users,
} from '../ui'

const categories = [
  'All',
  'Dance',
  'Music',
  'Art',
  'Photography',
  'Coding',
  'Writing',
]

const browse = [
  { label: 'Dance', match: 'Dance', icon: <Fire className="w-5 h-5" />, bg: 'bg-mint text-teal' },
  { label: 'Music', match: 'Music', icon: <Star className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-500' },
  { label: 'Art & Design', match: 'Art', icon: <Star className="w-5 h-5" />, bg: 'bg-rose-50 text-rose-400' },
  { label: 'Coding', match: 'Coding', icon: <Trophy className="w-5 h-5" />, bg: 'bg-indigo-50 text-indigo-400' },
]

type Featured = {
  badge: string
  title: string
  subtitle: string
  cta: string
  id: string
  theme: 'fest' | 'dance' | 'code'
}

const featured: Featured[] = [
  {
    badge: 'Season 4 · Live',
    title: 'Feedants Mega Fest',
    subtitle: 'Win up to ₹ 50,000 across 12 categories',
    cta: 'Join Now',
    id: 'feedants-classical-dance',
    theme: 'fest',
  },
  {
    badge: 'Weekend Special',
    title: 'Dance Face-Off',
    subtitle: 'Free entry this weekend · ₹ 10,000 pool',
    cta: 'Enter Free',
    id: 'bollywood-freestyle',
    theme: 'dance',
  },
  {
    badge: 'New · Hurry',
    title: 'Code Sprint 2026',
    subtitle: '48-hour build challenge · ₹ 25,000 prize',
    cta: 'Register',
    id: 'react-ui-challenge',
    theme: 'code',
  },
]

function withUniqueImages<T extends { img: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.img)) return false
    seen.add(item.img)
    return true
  })
}

/* Each banner gets its own surface + motif so they never read as one repeated template. */
const bannerThemes: Record<
  Featured['theme'],
  { surface: string; badgeIcon: ReactNode; motif: ReactNode }
> = {
  fest: {
    surface: 'bg-gradient-to-br from-teal to-[#0b6b63]',
    badgeIcon: <Trophy className="w-3.5 h-3.5" />,
    // Radiating burst — celebratory
    motif: (
      <>
        <div className="absolute -right-10 -top-12 w-44 h-44 rounded-full bg-amber-300/20" />
        <div className="absolute right-6 top-8 w-2 h-2 rotate-45 bg-amber-200/70" />
        <div className="absolute right-16 top-16 w-1.5 h-1.5 rounded-full bg-white/70" />
        <div className="absolute right-10 bottom-6 w-3 h-3 rotate-12 bg-white/40" />
        <div className="absolute right-24 bottom-10 w-1.5 h-1.5 rounded-full bg-amber-200/80" />
      </>
    ),
  },
  dance: {
    surface: 'bg-gradient-to-tr from-[#7c2d8f] via-[#a1327f] to-[#e0558a]',
    badgeIcon: <Fire className="w-3.5 h-3.5" />,
    // Sweeping arcs — motion / rhythm
    motif: (
      <>
        <div className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full border-[14px] border-white/15" />
        <div className="absolute -right-6 -top-10 w-32 h-32 rounded-full border-[10px] border-white/10" />
      </>
    ),
  },
  code: {
    surface: 'bg-[#0f1b2a]',
    badgeIcon: <Star className="w-3.5 h-3.5" />,
    // Terminal grid — technical
    motif: (
      <>
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #4fd1c5 1px, transparent 1px), linear-gradient(to bottom, #4fd1c5 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute right-4 top-4 font-mono text-[10px] text-teal/70 leading-relaxed">
          {'{ }'}<br />&lt;/&gt;
        </div>
      </>
    ),
  },
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const [active, setActive] = useState('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return competitions.filter((c) => {
      const matchCat =
        active === 'All' || c.tag.toLowerCase() === active.toLowerCase()
      const matchQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q)
      return matchCat && matchQuery
    })
  }, [active, query])

  const searching = query.trim().length > 0
  const trending = withUniqueImages(filtered.filter((c) => c.trending))
  const endingSoon = withUniqueImages(filtered.filter((c) => c.endsIn.startsWith('0')))

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <p className="text-slate text-xs">Discover</p>
          <h1 className="text-2xl font-extrabold text-ink leading-tight">Explore</h1>
        </div>
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink"
        >
          <Bell />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-teal" />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 space-y-5"
        data-scroll
      >
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl bg-white shadow-sm px-4 py-3">
          <span className="text-slate">
            <SearchIcon className="w-5 h-5" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search competitions, hosts…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-slate"
          />
          {searching && (
            <button
              onClick={() => setQuery('')}
              className="text-slate text-lg leading-none px-1"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active === c ? 'bg-teal text-white' : 'bg-white text-slate shadow-sm'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {searching || active !== 'All' ? (
          /* ---- Results view (filtered) ---- */
          <section>
            <SectionHeader
              title={
                searching ? `Results for “${query.trim()}”` : `${active} competitions`
              }
            />
            {filtered.length === 0 ? (
              <Card className="flex flex-col items-center text-center py-10 gap-2">
                <span className="text-slate">
                  <SearchIcon className="w-8 h-8" />
                </span>
                <p className="font-bold text-ink">No competitions found</p>
                <p className="text-sm text-slate">
                  Try a different keyword or category.
                </p>
                <button
                  onClick={() => {
                    setQuery('')
                    setActive('All')
                  }}
                  className="mt-2 rounded-lg bg-teal text-white text-sm font-semibold px-4 py-2"
                >
                  Reset filters
                </button>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <CompetitionRow key={c.id} c={c} />
                ))}
              </div>
            )}
          </section>
        ) : (
          /* ---- Default browse view ---- */
          <>
            {/* Featured banners */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4">
              {featured.map((f) => {
                const t = bannerThemes[f.theme]
                return (
                <div
                  key={f.title}
                  className={`relative snap-center shrink-0 w-[86%] overflow-hidden rounded-2xl text-white p-5 ${t.surface}`}
                >
                  {t.motif}
                  <span className="relative inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
                    {t.badgeIcon} {f.badge}
                  </span>
                  <h2 className="relative mt-3 text-xl font-extrabold leading-snug">
                    {f.title}
                  </h2>
                  <p className="relative text-sm text-white/85 mt-1">{f.subtitle}</p>
                  <button
                    onClick={() => navigate(`/competitions/${f.id}`)}
                    className="relative mt-4 rounded-lg bg-white text-ink text-sm font-semibold px-4 py-2"
                  >
                    {f.cta}
                  </button>
                </div>
                )
              })}
            </div>

            {/* Trending */}
            <section>
              <SectionHeader
                title="Trending Now"
                action="See all"
                onAction={() => navigate('/explore/trending')}
              />
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
                {trending.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/competitions/${t.id}`)}
                    className="shrink-0 w-[220px] text-left rounded-2xl bg-white shadow-sm overflow-hidden"
                  >
                    <div className="relative h-28">
                      <img
                        src={t.img}
                        alt={t.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 rounded-md bg-black/45 text-white text-[11px] font-medium px-2 py-0.5">
                        {t.tag}
                      </span>
                      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-white/90 text-teal text-[11px] font-semibold px-2 py-0.5">
                        <Users /> {t.joined}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-ink text-sm leading-tight">
                        {t.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate">Prize Pool</p>
                          <p className="text-teal font-extrabold">{t.prize}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate">Entry</p>
                          <p className="text-ink font-bold text-sm">{t.entry}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-teal font-semibold">
                        Only {t.spots} spots left
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Browse categories */}
            <section>
              <SectionHeader title="Browse Categories" />
              <div className="grid grid-cols-2 gap-3">
                {browse.map((b) => {
                  const count = competitions.filter((c) => c.tag === b.match).length
                  return (
                    <button
                      key={b.label}
                      onClick={() => setActive(b.match)}
                      className="text-left"
                    >
                      <Card className="flex items-center gap-3 p-4">
                        <span
                          className={`w-11 h-11 rounded-xl flex items-center justify-center ${b.bg}`}
                        >
                          {b.icon}
                        </span>
                        <div>
                          <p className="font-bold text-ink text-sm">{b.label}</p>
                          <p className="text-xs text-slate">{count} live</p>
                        </div>
                      </Card>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Ending soon */}
            <section>
              <SectionHeader
                title="Ending Soon"
                action="See all"
                onAction={() => navigate('/explore/ending')}
              />
              <div className="space-y-3">
                {endingSoon.map((c) => (
                  <CompetitionRow key={c.id} c={c} />
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
