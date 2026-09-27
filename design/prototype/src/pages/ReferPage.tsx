import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { personAvatar } from '../data'
import {
  ArrowLeft,
  CheckCircle,
  Chevron,
  Clock,
  Send,
  Shield,
  Trophy,
  Users,
} from '../ui'

/* ---------- local icons (currentColor, stroke-based) ---------- */
const ic = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...ic}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 012-2h10" />
  </svg>
)
const GiftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...ic}>
    <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S11 3 8.5 3 6 6 6 6s2 1 6 1zM12 7s1-4 3.5-4S18 6 18 6s-2 1-6 1z" />
  </svg>
)
const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...ic}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
)
const WhatsApp = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm0 2a8 8 0 016.8 12.2l-.3.5.7 2.4-2.5-.7-.5.3A8 8 0 1112 4zm-3.4 4c-.2 0-.5 0-.7.4-.2.4-.9.9-.9 2.2s.9 2.6 1 2.8c.2.2 1.8 3 4.5 4 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.6-.3s-1.4-.7-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.1-.3 0-.4.1-.6l.5-.5c.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5z" />
  </svg>
)

type FriendStatus = 'joined' | 'competed' | 'pending'

type Friend = {
  name: string
  when: string
  status: FriendStatus
  amount: number
}

const FRIENDS: Friend[] = [
  { name: 'Riya Sharma', when: '2 days ago', status: 'competed', amount: 100 },
  { name: 'Aarav Menon', when: '4 days ago', status: 'joined', amount: 50 },
  { name: 'Ishita Rao', when: '1 week ago', status: 'competed', amount: 100 },
  { name: 'Kabir Nair', when: '1 week ago', status: 'joined', amount: 50 },
  { name: 'Ananya Iyer', when: 'Just now', status: 'pending', amount: 0 },
  { name: 'Vivaan Shah', when: 'Yesterday', status: 'pending', amount: 0 },
]

const statusMeta: Record<
  FriendStatus,
  { label: string; tint: string; dot: string }
> = {
  competed: {
    label: 'Competed',
    tint: 'bg-mint text-teal-dark',
    dot: 'bg-teal',
  },
  joined: { label: 'Signed up', tint: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400' },
  pending: { label: 'Invite sent', tint: 'bg-neutral-100 text-slate', dot: 'bg-slate/50' },
}

const inr = (n: number) => '₹ ' + n.toLocaleString('en-IN')

const REFERRAL_CODE = 'NEHA100'
const REFERRAL_LINK = 'https://feedants.com/r/NEHA100'

// Milestone tiers — refer a running total of friends to unlock escalating bonuses.
const TIERS = [
  { count: 3, bonus: 150, label: 'Starter' },
  { count: 5, bonus: 300, label: 'Rising' },
  { count: 10, bonus: 750, label: 'Champion' },
  { count: 20, bonus: 2000, label: 'Legend' },
]

const STEPS = [
  {
    title: 'Share your link',
    body: 'Send your unique invite to friends on WhatsApp or anywhere.',
    icon: <ShareIcon />,
  },
  {
    title: 'They join & compete',
    body: 'Your friend signs up and enters their first competition.',
    icon: <Users />,
  },
  {
    title: 'You both earn',
    body: 'You get ₹100, they get ₹50 off their first entry fee.',
    icon: <GiftIcon className="w-[18px] h-[18px]" />,
  },
]

export default function ReferPage() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  const showToast = (m: string) => setToast(m)

  const joinedCount = FRIENDS.filter((f) => f.status !== 'pending').length
  const totalEarned = FRIENDS.reduce((s, f) => s + f.amount, 0)
  const pendingCount = FRIENDS.filter((f) => f.status === 'pending').length

  // The next unlocked milestone drives the headline progress bar.
  const nextTier = useMemo(
    () => TIERS.find((t) => t.count > joinedCount) ?? TIERS[TIERS.length - 1],
    [joinedCount],
  )
  const prevCount = useMemo(() => {
    const idx = TIERS.findIndex((t) => t.count === nextTier.count)
    return idx > 0 ? TIERS[idx - 1].count : 0
  }, [nextTier])
  const tierPct = Math.min(
    100,
    Math.round(
      ((joinedCount - prevCount) / (nextTier.count - prevCount)) * 100,
    ),
  )
  const toGo = Math.max(0, nextTier.count - joinedCount)

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      /* clipboard may be blocked; still confirm to the user */
    }
    showToast(label)
  }

  const share = async () => {
    const shareData = {
      title: 'Join me on Feedants',
      text: `Compete & win on Feedants! Use my code ${REFERRAL_CODE} for ₹50 off your first entry.`,
      url: REFERRAL_LINK,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        /* user dismissed the native sheet — fall through to the in-app one */
      }
    }
    setShareOpen(true)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-ink active:scale-95 transition"
        >
          <ArrowLeft />
        </button>
        <h1 className="text-xl font-extrabold text-ink leading-tight">
          Refer &amp; Earn
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28" data-scroll>
        {/* Hero — lifetime earnings + code */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d8074] via-teal to-[#155e56] p-5 text-white shadow-[0_16px_40px_-12px_rgba(13,128,116,0.6)]">
          <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute right-12 bottom-[-44px] h-28 w-28 rounded-full bg-white/5" />

          <div className="relative flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <GiftIcon className="w-[18px] h-[18px]" />
            </span>
            <span className="text-sm font-semibold tracking-wide">
              Invite friends, earn cash
            </span>
          </div>

          <div className="relative mt-5">
            <p className="text-xs text-white/75">Total earned so far</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
              {inr(totalEarned)}
            </p>
            <p className="mt-1 text-xs text-white/75">
              {joinedCount} friends joined ·{' '}
              <button
                onClick={() => navigate('/wallet')}
                className="font-semibold text-white underline underline-offset-2"
              >
                credited to wallet
              </button>
            </p>
          </div>

          {/* Referral code chip */}
          <div className="relative mt-5 flex items-center gap-2 rounded-2xl bg-white/15 p-1.5 pl-4 backdrop-blur-sm">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-white/70">
                Your code
              </p>
              <p className="text-lg font-extrabold tracking-[0.15em]">
                {REFERRAL_CODE}
              </p>
            </div>
            <button
              onClick={() => copy(REFERRAL_CODE, 'Referral code copied')}
              className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3.5 py-2.5 text-xs font-bold text-teal active:scale-95 transition"
            >
              <CopyIcon />
              Copy
            </button>
          </div>

          <button
            onClick={share}
            className="relative mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-extrabold text-teal shadow-sm active:scale-[0.99] transition"
          >
            <ShareIcon />
            Share invite link
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Invited', value: FRIENDS.length, icon: <Send /> },
            { label: 'Joined', value: joinedCount, icon: <Users /> },
            { label: 'Pending', value: pendingCount, icon: <Clock /> },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-3.5 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-teal [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {s.icon}
              </span>
              <p className="mt-2.5 text-2xl font-extrabold leading-none text-ink tabular-nums">
                {s.value}
              </p>
              <p className="mt-1 text-[11px] text-slate">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Milestone progress */}
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                <Trophy className="w-[18px] h-[18px]" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink leading-tight">
                  {nextTier.label} bonus
                </p>
                <p className="text-[11px] text-slate">
                  Unlock {inr(nextTier.bonus)}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-mint px-2.5 py-1 text-[11px] font-bold text-teal-dark">
              {joinedCount}/{nextTier.count}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal to-teal-dark transition-all duration-500"
              style={{ width: `${tierPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate">
            {toGo === 0 ? (
              <span className="font-semibold text-teal">
                Milestone reached — bonus credited! 🎉
              </span>
            ) : (
              <>
                Refer{' '}
                <span className="font-bold text-ink">{toGo} more</span>{' '}
                friend{toGo > 1 ? 's' : ''} to unlock{' '}
                <span className="font-bold text-teal">{inr(nextTier.bonus)}</span>
              </>
            )}
          </p>
        </div>

        {/* How it works */}
        <h2 className="mt-6 font-bold text-ink">How it works</h2>
        <div className="mt-3 rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3 px-4 py-3.5">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-teal">
                {s.icon}
                <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal text-[10px] font-extrabold text-white ring-2 ring-white">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold text-ink leading-tight">
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs text-slate leading-snug">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Reward tiers */}
        <h2 className="mt-6 font-bold text-ink">Reward tiers</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
          {TIERS.map((tier) => {
            const done = joinedCount >= tier.count
            const active = tier.count === nextTier.count && !done
            return (
              <div
                key={tier.count}
                className={`shrink-0 w-[128px] rounded-2xl p-3.5 shadow-sm transition ${
                  active
                    ? 'bg-teal text-white ring-2 ring-teal'
                    : 'bg-white'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    active
                      ? 'bg-white/15 text-white'
                      : done
                        ? 'bg-mint text-teal'
                        : 'bg-neutral-100 text-slate'
                  }`}
                >
                  {done ? <CheckCircle /> : <GiftIcon className="w-[18px] h-[18px]" />}
                </span>
                <p
                  className={`mt-2.5 text-lg font-extrabold leading-none tabular-nums ${
                    active ? 'text-white' : 'text-ink'
                  }`}
                >
                  {inr(tier.bonus)}
                </p>
                <p
                  className={`mt-1 text-[11px] ${
                    active ? 'text-white/80' : 'text-slate'
                  }`}
                >
                  {tier.count} referrals
                </p>
                {done && (
                  <span className="mt-2 inline-block rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-teal-dark">
                    Unlocked
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Referral activity */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-bold text-ink">Your referrals</h2>
          <span className="text-xs font-semibold text-slate">
            {FRIENDS.length} total
          </span>
        </div>
        <div className="mt-3 rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
          {FRIENDS.map((f) => {
            const meta = statusMeta[f.status]
            return (
              <div key={f.name} className="flex items-center gap-3 px-3.5 py-3">
                <img
                  src={personAvatar(f.name, 'notionists')}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full bg-mint object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink leading-tight">
                    {f.name}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tint}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label} · {f.when}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-sm font-extrabold tabular-nums ${
                    f.amount > 0 ? 'text-teal' : 'text-slate/60'
                  }`}
                >
                  {f.amount > 0 ? `+ ${inr(f.amount)}` : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Nudge to invite more */}
        <button
          onClick={share}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-mint px-4 py-3.5 text-left active:scale-[0.99] transition"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white">
            <Send />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink leading-tight">
              Invite more friends
            </p>
            <p className="text-[11px] text-slate">
              You earn ₹100 for every friend who competes
            </p>
          </div>
          <Chevron className="-rotate-90 w-4 h-4 text-teal shrink-0" />
        </button>

        {/* Terms */}
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <span className="mt-0.5 shrink-0 text-teal">
            <Shield />
          </span>
          <p className="text-[11px] leading-relaxed text-slate">
            Rewards are credited to your wallet within 24 hours of your friend's
            first paid entry. Self-referrals and duplicate accounts are not
            eligible. Feedants may update these terms anytime.
          </p>
        </div>
      </div>

      {/* Share sheet (fallback when the native share sheet is unavailable) */}
      {shareOpen && (
        <ShareSheet
          onClose={() => setShareOpen(false)}
          onCopyLink={() => {
            setShareOpen(false)
            copy(REFERRAL_LINK, 'Invite link copied')
          }}
          onCopyCode={() => {
            setShareOpen(false)
            copy(REFERRAL_CODE, 'Referral code copied')
          }}
          onChannel={(name) => {
            setShareOpen(false)
            showToast(`Opening ${name}…`)
          }}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 bottom-24 z-[80] -translate-x-1/2 w-max max-w-[90%]">
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

function ShareSheet({
  onClose,
  onCopyLink,
  onCopyCode,
  onChannel,
}: {
  onClose: () => void
  onCopyLink: () => void
  onCopyCode: () => void
  onChannel: (name: string) => void
}) {
  const channels = [
    {
      name: 'WhatsApp',
      icon: <WhatsApp />,
      tint: 'bg-[#25D366]/10 text-[#128C4A]',
    },
    { name: 'Messages', icon: <Send />, tint: 'bg-indigo-50 text-indigo-500' },
    { name: 'Email', icon: <Mail />, tint: 'bg-amber-50 text-amber-500' },
  ]
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink">Share your invite</h3>
          <button onClick={onClose} className="text-sm font-semibold text-slate">
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {channels.map((c) => (
            <button
              key={c.name}
              onClick={() => onChannel(c.name)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm active:scale-95 transition"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${c.tint}`}
              >
                {c.icon}
              </span>
              <span className="text-[11px] font-semibold text-ink">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 shadow-sm ring-1 ring-neutral-100">
          <span className="min-w-0 flex-1 truncate text-sm text-slate">
            {REFERRAL_LINK}
          </span>
          <button
            onClick={onCopyLink}
            className="flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2.5 text-xs font-bold text-white active:scale-95 transition"
          >
            <CopyIcon />
            Copy
          </button>
        </div>

        <button
          onClick={onCopyCode}
          className="mt-2 w-full rounded-xl bg-mint py-3 text-sm font-bold text-teal active:scale-[0.99] transition"
        >
          Copy code {REFERRAL_CODE}
        </button>
      </div>
    </div>
  )
}

/* Local mail glyph so the share sheet doesn't depend on prop-less ui.Mail size. */
function Mail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...ic}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}
