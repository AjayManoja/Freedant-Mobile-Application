import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { getWinnerProfile } from '../data'
import { startWinnerConversation } from '../messages'
import { BottomNav } from '../components/BottomNav'
import {
  ArrowLeft,
  Card,
  Chat,
  CheckCircle,
  Chevron,
  PlayBadge,
  Star,
  Trophy,
  Users,
} from '../ui'

export default function WinnerProfilePage() {
  const navigate = useNavigate()
  const { name: rawName } = useParams<{ name: string }>()
  const [params] = useSearchParams()
  const from = params.get('from') ?? undefined
  const name = decodeURIComponent(rawName ?? 'Winner')
  const profile = useMemo(() => getWinnerProfile(name, from), [name, from])

  const [following, setFollowing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const followers = profile.followers + (following ? 1 : 0)
  const followersLabel =
    followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : `${followers}`

  const stats = [
    { label: 'Wins', value: profile.wins, icon: <Trophy className="w-4 h-4" /> },
    { label: 'Entries', value: profile.entries, icon: <Star className="w-4 h-4" /> },
    { label: 'Followers', value: followersLabel, icon: <Users /> },
    { label: 'Rating', value: profile.rating, icon: <Star className="w-4 h-4 text-amber-400" /> },
  ]

  const ping = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-28" data-scroll>
        {/* Cover + header */}
        <div className="relative h-40">
          <img
            src={profile.cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/30 to-canvas" />
          <button
            onClick={() => navigate(-1)}
            className="relative flex items-center gap-2 px-5 pt-4 text-white font-bold text-lg drop-shadow"
          >
            <ArrowLeft />
            Profile
          </button>
        </div>

        <div className="px-4 -mt-14 relative space-y-4">
          {/* Identity */}
          <div className="flex flex-col items-center text-center">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-24 h-24 rounded-3xl object-cover bg-mint ring-4 ring-canvas shadow-lg"
            />
            <div className="mt-3 flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-ink">{profile.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                <Trophy className="w-3 h-3" /> Winner
              </span>
            </div>
            <p className="text-sm text-slate mt-0.5">
              @{profile.handle} · {profile.city}
            </p>
            <p className="text-sm text-ink/80 mt-2 max-w-[300px] leading-snug">
              {profile.bio}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate">
              <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 font-semibold text-teal">
                <Star className="w-3 h-3" /> {profile.topTag}
              </span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium">
                Member since {profile.memberSince}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFollowing((v) => !v)
                ping(following ? 'Unfollowed' : `Following ${profile.name}`)
              }}
              aria-pressed={following}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition active:scale-[0.99] ${
                following
                  ? 'bg-mint text-teal ring-1 ring-teal/30'
                  : 'bg-teal text-white'
              }`}
            >
              {following ? '✓ Following' : 'Follow'}
            </button>
            <button
              onClick={() => {
                const threadId = startWinnerConversation({
                  name: profile.name,
                  avatar: profile.avatar,
                  context: `Winner · ${profile.topTag}`,
                  wonTitle: profile.achievements[0]?.title ?? 'the competition',
                })
                navigate(`/messages/${threadId}`)
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white active:scale-[0.99] transition"
            >
              <Chat /> Message
            </button>
          </div>

          {/* Stats */}
          <Card className="flex items-stretch p-0 overflow-hidden">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`flex-1 flex flex-col items-center gap-1 py-3.5 ${
                  i > 0 ? 'border-l border-neutral-100' : ''
                }`}
              >
                <span className="text-teal">{s.icon}</span>
                <p className="text-lg font-extrabold text-ink leading-none">
                  {s.value}
                </p>
                <p className="text-[11px] text-slate">{s.label}</p>
              </div>
            ))}
          </Card>

          {/* Trophy case */}
          <div>
            <h2 className="font-bold text-ink mb-3 px-1">Achievements</h2>
            <div className="space-y-3">
              {profile.achievements.map((a, i) => (
                <button
                  key={`${a.compId}-${i}`}
                  onClick={() => navigate(`/competitions/${a.compId}`)}
                  className="w-full flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm text-left active:scale-[0.99] transition"
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-mint shrink-0">
                    <img src={a.img} alt="" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center text-white">
                      <PlayBadge />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink text-sm leading-tight truncate">
                      {a.title}
                    </p>
                    <p className="text-[11px] text-slate mt-0.5">
                      {a.tag} · {a.date}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-mint px-1.5 py-0.5 text-[10px] font-bold text-teal">
                        <Trophy className="w-3 h-3" /> {a.place}
                      </span>
                      <span className="text-[11px] font-semibold text-teal">
                        Won {a.prize}
                      </span>
                    </div>
                  </div>
                  <Chevron className="-rotate-90 w-4 h-4 text-slate shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="absolute left-1/2 bottom-24 z-[80] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg whitespace-nowrap">
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
