import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { CompetitionRow } from '../components/CompetitionRow'
import { competitions, endingSoonList, trendingList } from '../data'
import { ArrowLeft, Fire, Clock } from '../ui'

const configs = {
  trending: {
    title: 'Trending Now',
    icon: <Fire className="w-4 h-4" />,
    base: trendingList,
  },
  ending: {
    title: 'Ending Soon',
    icon: <Clock />,
    base: endingSoonList,
  },
} as const

type SortKey = 'popular' | 'prize' | 'ending'

const parsePrize = (p: string) => Number(p.replace(/[^\d]/g, ''))

export default function ListPage() {
  const navigate = useNavigate()
  const { type } = useParams<{ type: string }>()
  const config = configs[(type as keyof typeof configs) ?? 'trending'] ?? configs.trending
  const [sort, setSort] = useState<SortKey>('popular')

  const list = useMemo(() => {
    const base = config.base.length ? config.base : competitions
    const arr = [...base]
    if (sort === 'popular') arr.sort((a, b) => b.joined - a.joined)
    if (sort === 'prize') arr.sort((a, b) => parsePrize(b.prize) - parsePrize(a.prize))
    if (sort === 'ending') arr.sort((a, b) => a.endsIn.localeCompare(b.endsIn))
    return arr
  }, [config, sort])

  const sorts: { key: SortKey; label: string }[] = [
    { key: 'popular', label: 'Popular' },
    { key: 'prize', label: 'Top Prize' },
    { key: 'ending', label: 'Ending Soon' },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-ink font-bold text-lg"
        >
          <ArrowLeft />
          <span className="flex items-center gap-1.5">
            <span className="text-teal">{config.icon}</span>
            {config.title}
          </span>
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 space-y-4"
        data-scroll
      >
        {/* Sort chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate">Sort:</span>
          {sorts.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                sort === s.key ? 'bg-teal text-white' : 'bg-white text-slate shadow-sm'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate">{list.length} competitions</p>

        <div className="space-y-3">
          {list.map((c) => (
            <CompetitionRow key={c.id} c={c} />
          ))}
        </div>
      </div>

      <BottomNav />
    </>
  )
}
