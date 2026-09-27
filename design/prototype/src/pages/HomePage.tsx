import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { CompetitionRow } from '../components/CompetitionRow'
import {
  competitions,
  endingSoonList,
  trendingList,
  upcoming,
  type Upcoming,
} from '../data'
import {
  Bell,
  CalendarIcon,
  Card,
  Chat,
  CheckCircle,
  Chevron,
  Clock,
  Fire,
  Megaphone,
  SearchIcon,
  SectionHeader,
  Star,
  Trophy,
  Upload,
  Users,
  userImg,
} from '../ui'

const upcomingTints: Record<string, string> = {
  Kids: 'bg-rose-50 text-rose-400',
  Photography: 'bg-indigo-50 text-indigo-400',
  Poetry: 'bg-amber-50 text-amber-500',
}

function UpcomingRow({ u }: { u: Upcoming }) {
  const [notified, setNotified] = useState(false)
  return (
    <Card className="flex items-center gap-3 p-3">
      <span
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          upcomingTints[u.tag] ?? 'bg-mint text-teal'
        }`}
      >
        <CalendarIcon />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-sm leading-tight truncate">
          {u.title}
        </p>
        <p className="text-xs text-slate mt-0.5 truncate">
          {u.tag} · starts {u.starts} · entry {u.entry}
        </p>
        <p className="text-[11px] text-slate mt-1">
          Prize <span className="text-teal font-bold">{u.prize}</span>
        </p>
      </div>
      <button
        onClick={() => setNotified((v) => !v)}
        aria-pressed={notified}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
          notified
            ? 'bg-teal text-white'
            : 'border border-teal/40 text-teal bg-white'
        }`}
      >
        {notified ? <CheckCircle /> : <Bell className="w-4 h-4" />}
        {notified ? 'Notified' : 'Notify'}
      </button>
    </Card>
  )
}

const stats = [
  { label: 'Joined', value: '12', icon: <Trophy className="w-4 h-4" /> },
  { label: 'Won', value: '3', icon: <Star className="w-4 h-4" /> },
  { label: 'Rank', value: '#248', icon: <Users /> },
]

const categories = [
  { label: 'Dance', match: 'Dance', icon: <Fire className="w-5 h-5" />, bg: 'bg-mint text-teal' },
  { label: 'Music', match: 'Music', icon: <Star className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-500' },
  { label: 'Art', match: 'Art', icon: <Star className="w-5 h-5" />, bg: 'bg-rose-50 text-rose-400' },
  { label: 'Coding', match: 'Coding', icon: <Trophy className="w-5 h-5" />, bg: 'bg-indigo-50 text-indigo-400' },
]

/* A polished expand/collapse control that shows how many more items exist. */
function ExpandToggle({
  expanded,
  hidden,
  onToggle,
}: {
  expanded: boolean
  hidden: number
  onToggle: () => void
}) {
  if (!expanded && hidden <= 0) return null
  return (
    <button
      onClick={onToggle}
      className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-teal/20 bg-mint/60 py-2.5 text-xs font-semibold text-teal transition active:scale-[0.99]"
    >
      {expanded ? 'Show less' : `Show ${hidden} more`}
      <Chevron className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
  )
}

const ORB_TINTS = [
  'bg-gradient-to-br from-teal to-teal-dark',
  'bg-gradient-to-br from-indigo-400 to-indigo-600',
  'bg-gradient-to-br from-rose-400 to-rose-600',
  'bg-gradient-to-br from-amber-400 to-orange-500',
  'bg-gradient-to-br from-fuchsia-400 to-purple-600',
]
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function HomePage() {
  const navigate = useNavigate()
  const featured = competitions[0]
  const trending = trendingList.slice(0, 5)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAllEndingSoon, setShowAllEndingSoon] = useState(false)
  const [showAllTopPrize, setShowAllTopPrize] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, 3)
  const visibleEndingSoon = showAllEndingSoon
    ? endingSoonList
    : endingSoonList.slice(0, 3)
  const topPrize = useMemo(
    () =>
      [...competitions].sort(
        (a, b) =>
          Number(b.prize.replace(/[^\d]/g, '')) -
          Number(a.prize.replace(/[^\d]/g, '')),
      ),
    [],
  )
  const visibleTopPrize = showAllTopPrize ? topPrize : topPrize.slice(0, 3)

  // Top hosts — aggregated from real competition data so the host side of the
  // marketplace gets first-class visibility.
  const topHosts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; contests: number; entrants: number; rating: number }
    >()
    for (const c of competitions) {
      const h = map.get(c.host) ?? {
        name: c.host,
        contests: 0,
        entrants: 0,
        rating: 0,
      }
      h.contests += 1
      h.entrants += c.joined
      h.rating += c.rating
      map.set(c.host, h)
    }
    return [...map.values()]
      .map((h) => ({ ...h, rating: h.rating / h.contests }))
      .sort((a, b) => b.entrants - a.entrants)
      .slice(0, 6)
  }, [])

  // Recent winners — social proof drawn from top-rated contests.
  const winners = useMemo(
    () =>
      [...competitions]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6)
        .map((c, i) => ({
          contest: c,
          name: ['Aarav S.', 'Priya M.', 'Rohan K.', 'Neha T.', 'Ishaan V.', 'Diya R.'][i],
        })),
    [],
  )

  // Demo: surface a live notification for a random contest so the full
  // notification design is visible on the Home screen.
  const [toast, setToast] = useState<(typeof competitions)[number] | null>(null)
  const [toastIn, setToastIn] = useState(false)

  useEffect(() => {
    const pick = competitions[Math.floor(Math.random() * competitions.length)]
    const show = setTimeout(() => {
      setToast(pick)
      requestAnimationFrame(() => setToastIn(true))
    }, 1200)
    return () => clearTimeout(show)
  }, [])

  useEffect(() => {
    if (!toastIn) return
    const hide = setTimeout(() => setToastIn(false), 6000)
    return () => clearTimeout(hide)
  }, [toastIn])

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 text-left"
        >
          <span className="relative shrink-0">
            <img
              src={userImg}
              alt="Your profile"
              className="w-11 h-11 rounded-full object-cover bg-mint ring-2 ring-teal/30 ring-offset-2 ring-offset-canvas"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-sm">
              L7
            </span>
          </span>
          <div>
            <p className="text-slate text-xs">Good evening 👋</p>
            <h1 className="text-lg font-extrabold text-ink leading-tight">
              Manju Dubey
            </h1>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/messages')}
            aria-label="Messages"
            className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink active:scale-95 transition"
          >
            <Chat />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal px-1 text-[9px] font-bold text-white ring-2 ring-canvas">
              3
            </span>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink active:scale-95 transition"
          >
            <Bell />
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal ring-2 ring-white" />
            </span>
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 space-y-5"
        data-scroll
      >
        {/* Search (opens the dedicated search page) */}
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center gap-2 rounded-xl bg-white shadow-sm px-4 py-3 text-left"
        >
          <span className="text-slate">
            <SearchIcon className="w-5 h-5" />
          </span>
          <span className="flex-1 text-sm text-slate">
            Search competitions, hosts…
          </span>
        </button>

        {/* Community trust strip — social proof at marketplace scale */}
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-ink to-[#25384a] px-4 py-3 text-white shadow-sm">
          <div className="flex -space-x-2 shrink-0">
            {ORB_TINTS.slice(0, 3).map((t, i) => (
              <span
                key={i}
                className={`w-7 h-7 rounded-full ${t} ring-2 ring-ink flex items-center justify-center text-[10px] font-bold`}
              >
                {['A', 'K', 'M'][i]}
              </span>
            ))}
          </div>
          <p className="text-[13px] leading-snug">
            <span className="font-extrabold">24,800+ creators</span>
            <span className="text-white/70"> & </span>
            <span className="font-extrabold">3,100 hosts</span>
            <span className="text-white/70"> competing live</span>
          </p>
          <button
            onClick={() => navigate('/live')}
            className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold shrink-0 active:scale-95 transition"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </button>
        </div>

        {/* Player stats */}
        <Card className="flex items-stretch p-0 overflow-hidden">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 ${
                i > 0 ? 'border-l border-neutral-100' : ''
              }`}
            >
              <span className="w-9 h-9 rounded-xl bg-mint text-teal flex items-center justify-center shrink-0">
                {s.icon}
              </span>
              <div className="leading-none">
                <p className="text-lg font-extrabold text-ink leading-none">
                  {s.value}
                </p>
                <p className="text-[11px] text-slate mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </Card>

        {/* Refer & earn strip — links to the full referral dashboard */}
        <button
          onClick={() => navigate('/refer')}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-teal to-teal-dark px-4 py-3 text-left text-white shadow-sm active:scale-[0.99] transition"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S11 3 8.5 3 6 6 6 6s2 1 6 1zM12 7s1-4 3.5-4S18 6 18 6s-2 1-6 1z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight">
              Refer friends, earn ₹100 each
            </p>
            <p className="text-[11px] text-white/80">
              They get ₹50 off · you both win
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-teal">
            Invite
          </span>
        </button>

        {/* Featured banner */}
        <div className="relative w-full overflow-hidden rounded-3xl shadow-lg">
          <button
            onClick={() => navigate(`/competitions/${featured.id}`)}
            aria-label={`Open ${featured.title}`}
            className="absolute inset-0 z-10 active:scale-[0.99] transition"
          />
          <img
            src={featured.img}
            alt={featured.title}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-ink/10" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              <Fire className="w-3.5 h-3.5" /> Featured today
            </span>
            <button
              onClick={() => navigate('/live')}
              className="relative z-20 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm active:scale-95 transition"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              LIVE
            </button>
          </div>
          <div className="absolute left-4 right-4 bottom-4 text-white">
            <h2 className="text-2xl font-extrabold leading-tight">
              {featured.title}
            </h2>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <Trophy className="w-3.5 h-3.5" /> {featured.prize}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <Clock /> {featured.endsIn}
              </span>
              <button
                onClick={() => setJoinOpen(true)}
                className="relative z-20 ml-auto inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-teal shadow-sm active:scale-95 transition"
              >
                Join
                <Chevron className="-rotate-90 w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        <section>
          <SectionHeader
            title="Categories"
            action="Explore"
            onAction={() => navigate('/explore')}
          />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c.label}
                onClick={() => navigate('/explore')}
                className="shrink-0 flex flex-col items-center gap-1.5 w-16"
              >
                <span
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${c.bg}`}
                >
                  {c.icon}
                </span>
                <span className="text-[11px] font-semibold text-ink">
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Continue / active submission */}
        <button
          onClick={() => setDraftOpen(true)}
          className="w-full text-left rounded-2xl p-4 shadow-sm bg-gradient-to-br from-teal to-teal-dark text-white active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-white">
              <Upload />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm text-white">
                  Finish your submission
                </p>
                <span className="text-[11px] font-semibold text-white/90 shrink-0">
                  70%
                </span>
              </div>
              <p className="text-xs text-white/80 truncate">
                Acoustic Cover Battle · draft saved
              </p>
            </div>
            <span className="text-white/90 shrink-0">
              <Chevron className="-rotate-90 w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full w-[70%] rounded-full bg-white" />
          </div>
        </button>

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
                className="shrink-0 w-[200px] text-left rounded-2xl bg-white shadow-sm overflow-hidden"
              >
                <div className="relative h-24">
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
                  <p className="font-bold text-ink text-sm leading-tight truncate">
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
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Top hosts — surfaces the host side of the marketplace */}
        <section>
          <SectionHeader
            title="Top Hosts"
            action="See all"
            onAction={() => navigate('/explore')}
          />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {topHosts.map((h, i) => (
              <button
                key={h.name}
                onClick={() => navigate('/explore')}
                className="shrink-0 w-[150px] text-left rounded-2xl bg-white shadow-sm p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-11 h-11 rounded-full ${ORB_TINTS[i % ORB_TINTS.length]} flex items-center justify-center text-sm font-extrabold text-white shrink-0`}
                  >
                    {initials(h.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-ink text-sm leading-tight truncate">
                      {h.name}
                    </p>
                    <p className="flex items-center gap-0.5 text-[11px] text-slate">
                      <Star className="w-3 h-3 text-amber-400" />
                      {h.rating.toFixed(1)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-center">
                  <div className="flex-1">
                    <p className="text-ink font-extrabold text-sm leading-none">
                      {h.contests}
                    </p>
                    <p className="text-[10px] text-slate mt-1">Contests</p>
                  </div>
                  <div className="flex-1 border-l border-neutral-100">
                    <p className="text-teal font-extrabold text-sm leading-none">
                      {(h.entrants / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[10px] text-slate mt-1">Entrants</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Upcoming competitions */}
        <section>
          <SectionHeader title="Upcoming Competitions" />
          <div className="space-y-3">
            {visibleUpcoming.map((u) => (
              <UpcomingRow key={u.id} u={u} />
            ))}
          </div>
          <ExpandToggle
            expanded={showAllUpcoming}
            hidden={upcoming.length - 3}
            onToggle={() => setShowAllUpcoming((v) => !v)}
          />
        </section>

        {/* Ending soon */}
        <section>
          <SectionHeader title="Ending Soon" />
          <div className="space-y-3">
            {visibleEndingSoon.map((c) => (
              <CompetitionRow key={c.id} c={c} />
            ))}
          </div>
          <ExpandToggle
            expanded={showAllEndingSoon}
            hidden={endingSoonList.length - 3}
            onToggle={() => setShowAllEndingSoon((v) => !v)}
          />
        </section>

        {/* Top prize */}
        <section>
          <SectionHeader title="Top Prize" />
          <div className="space-y-3">
            {visibleTopPrize.map((c) => (
              <CompetitionRow key={c.id} c={c} />
            ))}
          </div>
          <ExpandToggle
            expanded={showAllTopPrize}
            hidden={topPrize.length - 3}
            onToggle={() => setShowAllTopPrize((v) => !v)}
          />
        </section>

        {/* Recent winners — social proof */}
        <section>
          <SectionHeader
            title="Recent Winners"
            action="See all"
            onAction={() => navigate('/explore')}
          />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {winners.map((w, i) => (
              <button
                key={w.contest.id}
                onClick={() =>
                  navigate(
                    `/winners/${encodeURIComponent(w.name)}?from=${w.contest.id}`,
                  )
                }
                className="shrink-0 w-[160px] text-left rounded-2xl bg-white shadow-sm overflow-hidden active:scale-[0.98] transition"
              >
                <div className="relative h-20">
                  <img
                    src={w.contest.img}
                    alt={w.contest.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    <Trophy className="w-3 h-3" /> Winner
                  </span>
                </div>
                <div className="p-3 -mt-6 relative">
                  <span
                    className={`w-10 h-10 rounded-full ${ORB_TINTS[i % ORB_TINTS.length]} ring-2 ring-white flex items-center justify-center text-xs font-extrabold text-white`}
                  >
                    {initials(w.name)}
                  </span>
                  <p className="mt-2 font-bold text-ink text-sm leading-tight truncate">
                    {w.name}
                  </p>
                  <p className="text-[11px] text-slate truncate">
                    {w.contest.title}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-teal">
                    Won {w.contest.prize}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Host your own competition — full host-acquisition section */}
        <HostCTASection onStart={() => navigate('/host')} />
      </div>

      {/* Live push notification (native-style banner — demo) */}
      {toast && (
        <div
          className={`absolute left-3 right-3 top-2 z-50 transition-all duration-300 ease-out ${
            toastIn
              ? 'translate-y-0 opacity-100 scale-100'
              : '-translate-y-8 opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <button
            onClick={() => {
              setToastIn(false)
              navigate(`/competitions/${toast.id}`)
            }}
            className="w-full text-left rounded-[26px] bg-white/80 backdrop-blur-xl px-3.5 pt-3 pb-2.5 shadow-[0_12px_40px_-8px_rgba(27,43,58,0.35)] ring-1 ring-black/[0.06]"
          >
            {/* Header row: app icon · app name · time */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-[7px] bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center shrink-0 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Feedants
              </span>
              <span className="ml-auto text-[11px] text-slate/70">now</span>
            </div>
            {/* Body */}
            <div className="mt-1.5">
              <p className="font-bold text-ink text-[15px] leading-tight">
                🎉 New competition is live!
              </p>
              <p className="text-[13px] text-ink/70 leading-snug mt-0.5">
                {toast.title} · {toast.tag} — prize pool {toast.prize}. Tap to
                register before spots fill up.
              </p>
            </div>
            {/* Grabber */}
            <div className="mt-2 mx-auto h-1 w-9 rounded-full bg-ink/15" />
          </button>
        </div>
      )}

      <JoinSheet
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        comp={featured}
        onView={() => {
          setJoinOpen(false)
          navigate(`/competitions/${featured.id}`)
        }}
      />

      <ResumeDraftSheet
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        onView={() => {
          setDraftOpen(false)
          navigate('/competitions/acoustic-cover-battle')
        }}
      />

      <BottomNav />
    </>
  )
}

/* ---------------------------------------------------------------------------
   Host your own competition — a single, self-contained promo banner in the
   pattern professional mobile apps use for a "become a host" entrypoint: one
   clean card, an icon, a tight headline, one supporting line and one button.
--------------------------------------------------------------------------- */

function HostCTASection({ onStart }: { onStart: () => void }) {
  return (
    <button
      onClick={onStart}
      className="relative block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-teal-dark p-6 text-left text-white shadow-sm active:scale-[0.99] transition"
    >
      <span className="pointer-events-none absolute -right-8 -bottom-10 h-40 w-40 rounded-full bg-white/10" />

      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 [&_svg]:text-white">
        <Megaphone className="w-6 h-6" />
      </span>

      <h3 className="relative mt-4 text-xl font-extrabold leading-tight">
        Host your own competition
      </h3>
      <p className="relative mt-1.5 max-w-[280px] text-sm leading-snug text-white/80">
        Launch a contest, reach thousands of creators and reward the best.
      </p>

      <span className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-teal">
        Get started
        <Chevron className="-rotate-90 w-4 h-4" />
      </span>

      <p className="relative mt-3 text-[11px] text-white/70">
        Free to start · 3,100+ hosts
      </p>
    </button>
  )
}

type FeaturedComp = (typeof competitions)[number]

function JoinSheet({
  open,
  onClose,
  comp,
  onView,
}: {
  open: boolean
  onClose: () => void
  comp: FeaturedComp
  onView: () => void
}) {
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form')

  // Reset to the form whenever the sheet is reopened.
  useEffect(() => {
    if (open) setPhase('form')
  }, [open])

  const confirm = () => {
    setPhase('processing')
    setTimeout(() => setPhase('done'), 1400)
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center transition ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Scrim */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Sheet */}
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl bg-white px-5 pb-8 pt-3 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />

        {phase === 'done' ? (
          <div className="pt-6 pb-2 text-center">
            <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-mint text-teal [&_svg]:w-8 [&_svg]:h-8">
              <CheckCircle />
            </span>
            <h3 className="mt-4 text-xl font-extrabold text-ink">You're in! 🎉</h3>
            <p className="mt-1 text-sm text-slate">
              Your spot in {comp.title} is confirmed. Good luck!
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-mint py-3 text-sm font-bold text-teal"
              >
                Done
              </button>
              <button
                onClick={onView}
                className="flex-1 rounded-xl bg-teal py-3 text-sm font-bold text-white"
              >
                View competition
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-3">
              <img
                src={comp.img}
                alt={comp.title}
                className="w-14 h-14 rounded-xl object-cover bg-mint"
              />
              <div className="min-w-0">
                <h3 className="font-extrabold text-ink leading-tight truncate">
                  {comp.title}
                </h3>
                <p className="text-xs text-slate mt-0.5">
                  {comp.tag} · hosted by {comp.host}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Prize pool', value: comp.prize },
                { label: 'Spots left', value: comp.spots },
                { label: 'Ends in', value: comp.endsIn },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-canvas py-3">
                  <p className="text-sm font-extrabold text-ink">{s.value}</p>
                  <p className="text-[10px] text-slate mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-mint/60 px-4 py-3">
              <span className="text-sm font-semibold text-ink">Entry fee</span>
              <span className="text-lg font-extrabold text-teal">
                {comp.entry}
              </span>
            </div>

            <button
              onClick={confirm}
              disabled={phase === 'processing'}
              className="mt-4 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white shadow-sm active:scale-[0.99] transition disabled:opacity-70"
            >
              {phase === 'processing' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Processing…
                </span>
              ) : (
                `Confirm & Join · ${comp.entry}`
              )}
            </button>
            <p className="mt-2.5 text-center text-[11px] text-slate">
              Secure payment · Cancel anytime before it starts
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/* Resume-draft flow for the "Finish your submission" banner. Shows the saved
   draft's checklist at 70%, lets the user tick off the remaining steps and
   submit. */
function ResumeDraftSheet({
  open,
  onClose,
  onView,
}: {
  open: boolean
  onClose: () => void
  onView: () => void
}) {
  const initialSteps = [
    { label: 'Record acoustic cover', hint: 'cover-final.mp4 · 2:41', done: true },
    { label: 'Add title & description', hint: 'Draft saved', done: true },
    { label: 'Pick a thumbnail', hint: 'Choose a frame or upload', done: true },
    { label: 'Agree to contest rules', hint: 'Original work · no covers ban', done: false },
    { label: 'Confirm & submit entry', hint: 'Final step', done: false },
  ]
  const [steps, setSteps] = useState(initialSteps)
  const [phase, setPhase] = useState<'edit' | 'submitting' | 'done'>('edit')

  useEffect(() => {
    if (open) {
      setSteps(initialSteps)
      setPhase('edit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const doneCount = steps.filter((s) => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const allDone = doneCount === steps.length

  const toggle = (i: number) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)))

  const submit = () => {
    setPhase('submitting')
    setTimeout(() => setPhase('done'), 1500)
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />

        {phase === 'done' ? (
          <div className="pt-6 pb-2 text-center">
            <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-mint text-teal [&_svg]:w-8 [&_svg]:h-8">
              <CheckCircle />
            </span>
            <h3 className="mt-4 text-xl font-extrabold text-ink">Entry submitted! 🎉</h3>
            <p className="mt-1 text-sm text-slate">
              Your acoustic cover is in the Acoustic Cover Battle. You'll be
              notified when judging begins.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-mint py-3 text-sm font-bold text-teal"
              >
                Done
              </button>
              <button
                onClick={onView}
                className="flex-1 rounded-xl bg-teal py-3 text-sm font-bold text-white"
              >
                View competition
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mt-3 flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-teal/10 text-teal flex items-center justify-center shrink-0">
                <Upload />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-ink leading-tight">
                  Finish your submission
                </h3>
                <p className="text-xs text-slate mt-0.5">
                  Acoustic Cover Battle · draft saved
                </p>
              </div>
              <span className="text-lg font-extrabold text-teal shrink-0">{pct}%</span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Checklist */}
            <div className="mt-4 space-y-2">
              {steps.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => toggle(i)}
                  className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition active:scale-[0.99] ${
                    s.done ? '' : 'ring-1 ring-teal/20'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition [&_svg]:w-4 [&_svg]:h-4 ${
                      s.done
                        ? 'bg-teal text-white'
                        : 'border-2 border-ink/15 text-transparent'
                    }`}
                  >
                    <CheckCircle />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        s.done ? 'text-ink' : 'text-ink'
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[11px] text-slate mt-0.5 truncate">{s.hint}</p>
                  </div>
                  {!s.done && (
                    <span className="text-[11px] font-semibold text-teal shrink-0">
                      Add
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={submit}
              disabled={!allDone || phase === 'submitting'}
              className="mt-5 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              {phase === 'submitting' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Submitting…
                </span>
              ) : allDone ? (
                'Submit entry'
              ) : (
                `Complete ${steps.length - doneCount} more step${
                  steps.length - doneCount > 1 ? 's' : ''
                }`
              )}
            </button>
            <p className="mt-2.5 text-center text-[11px] text-slate">
              Your progress is saved automatically
            </p>
          </>
        )}
      </div>
    </div>
  )
}

