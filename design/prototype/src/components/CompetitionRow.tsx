import { useNavigate } from 'react-router'
import type { Competition } from '../data'
import { Card, Clock, Star, Users } from '../ui'

export function CompetitionRow({ c }: { c: Competition }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/competitions/${c.id}`)}
      className="w-full text-left"
    >
      <Card className="flex items-center gap-3 p-3">
        <img
          src={c.img}
          alt={c.title}
          className="w-16 h-16 rounded-xl object-cover bg-mint shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink text-sm leading-tight truncate">
            {c.title}
          </p>
          <p className="text-xs text-slate mt-0.5">
            {c.tag} · {c.host}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
            <span className="flex items-center gap-1 text-teal font-semibold">
              <Clock /> {c.endsIn}
            </span>
            <span className="flex items-center gap-1 text-slate">
              <Star className="w-3 h-3 text-amber-400" /> {c.rating}
            </span>
            <span className="flex items-center gap-1 text-slate">
              <Users /> {c.joined}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate">Prize</p>
          <p className="text-teal font-extrabold">{c.prize}</p>
          <p className="text-[10px] text-slate mt-1">Entry {c.entry}</p>
        </div>
      </Card>
    </button>
  )
}
