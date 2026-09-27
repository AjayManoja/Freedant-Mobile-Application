import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { mySubmissions } from '../data'
import {
  ArrowLeft,
  CheckCircle,
  Razorpay,
  Shield,
  Trophy,
} from '../ui'
import aaravImg from '../assets/avatars/aarav.jpg'
import ishitaImg from '../assets/avatars/ishita.jpg'
import riyaImg from '../assets/avatars/riya.jpg'

/* ---------- local fintech icons (currentColor, stroke-based) ---------- */
const ic = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
const Eye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...ic}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...ic}>
    <path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A9.9 9.9 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 004-.9" />
  </svg>
)
const ArrowUpRight = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...ic}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
)
const ArrowDownLeft = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...ic}>
    <path d="M17 7L7 17M16 17H7V8" />
  </svg>
)
const SendIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...ic}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
)
const GiftIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...ic}>
    <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S11 3 8.5 3 6 6 6 6s2 1 6 1zM12 7s1-4 3.5-4S18 6 18 6s-2 1-6 1z" />
  </svg>
)

type TxKind = 'earning' | 'payout' | 'entry' | 'bonus' | 'topup'
type Group = 'Today' | 'This week' | 'Earlier'

type Tx = {
  id: string
  kind: TxKind
  title: string
  sub: string
  date: string
  amount: number // signed rupees
  group: Group
}

const parseMoney = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0
const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN')
const inr = (n: number) => '₹ ' + fmt(n)

const groupFor = (date: string): Group =>
  date.includes('Today')
    ? 'Today'
    : date.includes('Yesterday') || /2[0-9] Sep/.test(date)
      ? 'This week'
      : 'Earlier'

// Seed a realistic ledger from the user's real submissions: prize credits for
// wins, entry-fee debits for every entry, plus a referral bonus and a payout.
function seedTransactions(): Tx[] {
  const txns: Tx[] = []
  mySubmissions.forEach((s) => {
    txns.push({
      id: `entry-${s.comp.id}`,
      kind: 'entry',
      title: `Entry — ${s.comp.title}`,
      sub: s.comp.tag,
      date: s.submittedOn,
      amount: -parseMoney(s.comp.entry),
      group: groupFor(s.submittedOn),
    })
    if (s.status === 'Won' && s.prize) {
      txns.push({
        id: `prize-${s.comp.id}`,
        kind: 'earning',
        title: `Prize — ${s.comp.title}`,
        sub: `${s.place} · ${s.comp.tag}`,
        date: s.submittedOn,
        amount: parseMoney(s.prize),
        group: groupFor(s.submittedOn),
      })
    }
  })
  txns.push({
    id: 'bonus-referral',
    kind: 'bonus',
    title: 'Referral bonus',
    sub: 'Friend joined via your link',
    date: '20 Sep 26',
    amount: 100,
    group: 'This week',
  })
  // Opening top-up — funds the account so entry fees and the bank withdrawal
  // below don't drive the available balance negative.
  txns.push({
    id: 'topup-opening',
    kind: 'topup',
    title: 'Added to wallet',
    sub: 'via Razorpay',
    date: '05 Sep 26',
    amount: 2000,
    group: 'Earlier',
  })
  txns.push({
    id: 'payout-1',
    kind: 'payout',
    title: 'Withdrawal to bank',
    sub: 'HDFC •••• 4291',
    date: '10 Sep 26',
    amount: -1500,
    group: 'Earlier',
  })
  return txns
}

const FILTERS: { key: 'all' | TxKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'earning', label: 'Earnings' },
  { key: 'payout', label: 'Payouts' },
  { key: 'entry', label: 'Entries' },
]

const kindMeta: Record<TxKind, { icon: React.ReactNode; tint: string }> = {
  earning: { icon: <Trophy className="w-4 h-4" />, tint: 'bg-mint text-teal' },
  payout: { icon: <ArrowUpRight />, tint: 'bg-indigo-50 text-indigo-500' },
  entry: { icon: <ArrowUpRight />, tint: 'bg-neutral-100 text-slate' },
  bonus: { icon: <GiftIcon />, tint: 'bg-amber-50 text-amber-600' },
  topup: { icon: <ArrowDownLeft />, tint: 'bg-mint text-teal' },
}

const GROUP_ORDER: Group[] = ['Today', 'This week', 'Earlier']

export default function WalletPage() {
  const navigate = useNavigate()

  const [txns, setTxns] = useState<Tx[]>(seedTransactions)
  const [balance, setBalance] = useState(() =>
    seedTransactions().reduce((s, t) => s + t.amount, 0),
  )
  const [hidden, setHidden] = useState(false)
  const [filter, setFilter] = useState<'all' | TxKind>('all')
  const [sheet, setSheet] = useState<'withdraw' | 'add' | 'send' | 'rewards' | null>(
    null,
  )
  const [claimed, setClaimed] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const lifetime = useMemo(
    () => txns.filter((t) => t.kind === 'earning').reduce((s, t) => s + t.amount, 0),
    [txns],
  )

  const filtered = filter === 'all' ? txns : txns.filter((t) => t.kind === filter)
  const grouped = useMemo(() => {
    const map: Record<Group, Tx[]> = { Today: [], 'This week': [], Earlier: [] }
    for (const t of filtered) map[t.group].push(t)
    return GROUP_ORDER.filter((g) => map[g].length).map((g) => ({ g, items: map[g] }))
  }, [filtered])

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2400)
  }

  const addTx = (tx: Omit<Tx, 'group' | 'date'>) => {
    const full: Tx = { ...tx, date: 'Today · just now', group: 'Today' }
    setTxns((prev) => [full, ...prev])
    setBalance((b) => b + tx.amount)
  }

  const QUICK = [
    { label: 'Withdraw', icon: <ArrowUpRight />, onClick: () => setSheet('withdraw') },
    { label: 'Add money', icon: <ArrowDownLeft />, onClick: () => setSheet('add') },
    { label: 'Send', icon: <SendIcon />, onClick: () => setSheet('send') },
    { label: 'Rewards', icon: <GiftIcon />, onClick: () => setSheet('rewards') },
  ]

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
        <h1 className="text-xl font-extrabold text-ink leading-tight">Wallet</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28" data-scroll>
        {/* Balance card — payment-card styling */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d8074] via-teal to-[#155e56] p-5 text-white shadow-[0_16px_40px_-12px_rgba(13,128,116,0.6)]">
          {/* motifs */}
          <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute right-10 bottom-[-40px] h-28 w-28 rounded-full bg-white/5" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 [&_svg]:h-4 [&_svg]:w-4">
                <Trophy className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold tracking-wide">Feedants Wallet</span>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
              Prime
            </span>
          </div>

          <div className="relative mt-6">
            <p className="text-xs text-white/75">Available balance</p>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-4xl font-extrabold tracking-tight tabular-nums">
                {hidden ? '₹ ••••••' : inr(balance)}
              </p>
              <button
                onClick={() => setHidden((v) => !v)}
                aria-label={hidden ? 'Show balance' : 'Hide balance'}
                className="text-white/80 active:scale-90 transition"
              >
                {hidden ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          <div className="relative mt-5 flex items-center justify-between border-t border-white/15 pt-4">
            <span className="font-mono text-sm tracking-[0.2em] text-white/85">
              •••• •••• 4291
            </span>
            <span className="text-xs font-semibold text-white/75">Neha Sharma</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 flex items-start justify-between px-1">
          {QUICK.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="flex flex-1 flex-col items-center gap-2 active:scale-95 transition"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal shadow-sm">
                {a.icon}
              </span>
              <span className="text-[11px] font-semibold text-ink">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Earnings summary */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-teal">
              <Trophy className="w-4 h-4" />
            </span>
            <p className="mt-2.5 text-xl font-extrabold text-ink leading-none tabular-nums">
              {hidden ? '₹ ••••' : inr(lifetime)}
            </p>
            <p className="mt-1 text-[11px] text-slate">Total winnings</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              <ArrowUpRight />
            </span>
            <p className="mt-2.5 text-xl font-extrabold text-ink leading-none tabular-nums">
              {hidden ? '₹ ••••' : '₹ 550'}
            </p>
            <p className="mt-1 text-[11px] text-slate">Pending payout</p>
          </div>
        </div>

        {/* Secure note */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-mint/60 px-4 py-2.5 text-teal">
          <Shield />
          <p className="text-xs font-medium">
            Payouts land in your bank within 24–48 hours.
          </p>
        </div>

        {/* Transactions */}
        <h2 className="mt-6 font-bold text-ink">Transactions</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-ink text-white shadow-sm'
                    : 'bg-white ring-1 ring-neutral-200 text-slate'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {grouped.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate">
            No transactions in this category.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {grouped.map(({ g, items }) => (
              <div key={g}>
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate">
                  {g}
                </p>
                <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
                  {items.map((t) => {
                    const meta = kindMeta[t.kind]
                    const credit = t.amount > 0
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-3.5 py-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tint} [&_svg]:h-[18px] [&_svg]:w-[18px]`}
                        >
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink leading-tight truncate">
                            {t.title}
                          </p>
                          <p className="text-[11px] text-slate truncate">
                            {t.sub} · {t.date}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-extrabold tabular-nums ${
                            credit ? 'text-teal' : 'text-ink'
                          }`}
                        >
                          {credit ? '+ ' : '− '}
                          {hidden ? '••••' : inr(t.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sheet === 'withdraw' && (
        <WithdrawSheet
          balance={balance}
          onClose={() => setSheet(null)}
          onDone={(amt, method) => {
            setSheet(null)
            addTx({
              id: `payout-${Date.now()}`,
              kind: 'payout',
              title: 'Withdrawal',
              sub: method,
              amount: -amt,
            })
            showToast(`${inr(amt)} withdrawal requested 🎉`)
          }}
        />
      )}
      {sheet === 'add' && (
        <AddMoneySheet
          onClose={() => setSheet(null)}
          onDone={(amt) => {
            setSheet(null)
            addTx({
              id: `topup-${Date.now()}`,
              kind: 'topup',
              title: 'Added to wallet',
              sub: 'via Razorpay',
              amount: amt,
            })
            showToast(`${inr(amt)} added to wallet`)
          }}
        />
      )}

      {sheet === 'send' && (
        <SendSheet
          balance={balance}
          onClose={() => setSheet(null)}
          onDone={(amt, name) => {
            setSheet(null)
            addTx({
              id: `send-${Date.now()}`,
              kind: 'payout',
              title: `Sent to ${name}`,
              sub: 'Feedants transfer',
              amount: -amt,
            })
            showToast(`${inr(amt)} sent to ${name} 🎉`)
          }}
        />
      )}
      {sheet === 'rewards' && (
        <RewardsSheet
          claimed={claimed}
          onClose={() => setSheet(null)}
          onClaim={(reward) => {
            setClaimed((prev) => [...prev, reward.id])
            addTx({
              id: `reward-${reward.id}-${Date.now()}`,
              kind: 'bonus',
              title: reward.title,
              sub: 'Reward credited',
              amount: reward.amount,
            })
            showToast(`${inr(reward.amount)} reward credited 🎁`)
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

const QUICK_AMTS = [500, 1000, 2000]

function WithdrawSheet({
  balance,
  onClose,
  onDone,
}: {
  balance: number
  onClose: () => void
  onDone: (amount: number, method: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'upi' | 'bank'>('upi')
  const [processing, setProcessing] = useState(false)
  const num = Number(amount) || 0
  const valid = num >= 100 && num <= balance

  const methodLabel = method === 'upi' ? 'UPI · neha@okhdfc' : 'HDFC •••• 4291'

  const submit = () => {
    if (!valid) return
    setProcessing(true)
    setTimeout(() => onDone(num, methodLabel), 1100)
  }

  return (
    <SheetShell title="Withdraw money" onClose={onClose}>
      <p className="text-xs text-slate">
        Available: <span className="font-bold text-ink">{inr(balance)}</span>
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-100">
        <span className="text-2xl font-extrabold text-ink">₹</span>
        <input
          autoFocus
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0"
          className="w-full bg-transparent text-2xl font-extrabold text-ink outline-none placeholder:text-slate/40"
        />
      </div>
      <div className="mt-2 flex gap-2">
        {QUICK_AMTS.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(String(Math.min(q, balance)))}
            className="flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-teal ring-1 ring-teal/20"
          >
            {inr(q)}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate">
        Withdraw to
      </p>
      <div className="mt-2 space-y-2">
        {[
          { id: 'upi' as const, label: 'UPI', sub: 'neha@okhdfc', node: <Razorpay /> },
          { id: 'bank' as const, label: 'Bank account', sub: 'HDFC •••• 4291', node: <Shield /> },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm transition ${
              method === m.id ? 'ring-2 ring-teal' : 'ring-1 ring-neutral-100'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-teal">
              {m.node}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{m.label}</p>
              <p className="text-xs text-slate">{m.sub}</p>
            </div>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                method === m.id ? 'bg-teal text-white' : 'border-2 border-neutral-200'
              } [&_svg]:h-3 [&_svg]:w-3`}
            >
              {method === m.id && <CheckCircle />}
            </span>
          </button>
        ))}
      </div>

      <button
        disabled={!valid || processing}
        onClick={submit}
        className="mt-5 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
      >
        {processing ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Processing…
          </span>
        ) : num > balance ? (
          'Amount exceeds balance'
        ) : num > 0 && num < 100 ? (
          'Minimum ₹ 100'
        ) : (
          `Withdraw ${num > 0 ? inr(num) : ''}`
        )}
      </button>
    </SheetShell>
  )
}

function AddMoneySheet({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (amount: number) => void
}) {
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const num = Number(amount) || 0

  const submit = () => {
    if (num < 1) return
    setProcessing(true)
    setTimeout(() => onDone(num), 1100)
  }

  return (
    <SheetShell title="Add money" onClose={onClose}>
      <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-100">
        <span className="text-2xl font-extrabold text-ink">₹</span>
        <input
          autoFocus
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0"
          className="w-full bg-transparent text-2xl font-extrabold text-ink outline-none placeholder:text-slate/40"
        />
      </div>
      <div className="mt-2 flex gap-2">
        {QUICK_AMTS.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(String(q))}
            className="flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-teal ring-1 ring-teal/20"
          >
            {inr(q)}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate">
        <Shield /> Secured by <Razorpay />
      </div>
      <button
        disabled={num < 1 || processing}
        onClick={submit}
        className="mt-4 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
      >
        {processing ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Processing…
          </span>
        ) : num > 0 ? (
          `Add ${inr(num)}`
        ) : (
          'Enter an amount'
        )}
      </button>
    </SheetShell>
  )
}

/* ---------- Send (P2P transfer) ---------- */

type Contact = { id: string; name: string; handle: string; avatar: string }

const CONTACTS: Contact[] = [
  { id: 'aarav', name: 'Aarav Menon', handle: '@aaravm', avatar: aaravImg },
  { id: 'ishita', name: 'Ishita Rao', handle: '@ishita.r', avatar: ishitaImg },
  { id: 'riya', name: 'Riya Sharma', handle: '@riya', avatar: riyaImg },
]

function SendSheet({
  balance,
  onClose,
  onDone,
}: {
  balance: number
  onClose: () => void
  onDone: (amount: number, name: string) => void
}) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const num = Number(amount) || 0
  const valid = !!contact && num >= 1 && num <= balance

  const submit = () => {
    if (!valid || !contact) return
    setProcessing(true)
    setTimeout(() => onDone(num, contact.name.split(' ')[0]), 1100)
  }

  return (
    <SheetShell title="Send money" onClose={onClose}>
      <p className="text-xs text-slate">
        Available: <span className="font-bold text-ink">{inr(balance)}</span>
      </p>

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate">
        Send to
      </p>
      <div className="mt-2 flex gap-3">
        {CONTACTS.map((c) => {
          const active = contact?.id === c.id
          return (
            <button
              key={c.id}
              onClick={() => setContact(c)}
              className="flex flex-1 flex-col items-center gap-1.5 active:scale-95 transition"
            >
              <span className="relative">
                <img
                  src={c.avatar}
                  alt={c.name}
                  className={`h-14 w-14 rounded-full object-cover transition ${
                    active ? 'ring-2 ring-teal ring-offset-2 ring-offset-canvas' : ''
                  }`}
                />
                {active && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white ring-2 ring-canvas [&_svg]:h-3 [&_svg]:w-3">
                    <CheckCircle />
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold text-ink leading-tight">
                {c.name.split(' ')[0]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-100">
        <span className="text-2xl font-extrabold text-ink">₹</span>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="0"
          className="w-full bg-transparent text-2xl font-extrabold text-ink outline-none placeholder:text-slate/40"
        />
      </div>
      <div className="mt-2 flex gap-2">
        {QUICK_AMTS.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(String(Math.min(q, balance)))}
            className="flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-teal ring-1 ring-teal/20"
          >
            {inr(q)}
          </button>
        ))}
      </div>

      <button
        disabled={!valid || processing}
        onClick={submit}
        className="mt-5 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
      >
        {processing ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Sending…
          </span>
        ) : !contact ? (
          'Choose a recipient'
        ) : num > balance ? (
          'Amount exceeds balance'
        ) : num < 1 ? (
          'Enter an amount'
        ) : (
          `Send ${inr(num)} to ${contact.name.split(' ')[0]}`
        )}
      </button>
    </SheetShell>
  )
}

/* ---------- Rewards ---------- */

type Reward = { id: string; title: string; sub: string; amount: number }

const REWARDS: Reward[] = [
  { id: 'streak', title: '7-day login streak', sub: 'Claim your weekly bonus', amount: 50 },
  { id: 'refer', title: 'Refer & earn', sub: 'Riya joined via your link', amount: 100 },
  { id: 'firstwin', title: 'First win badge', sub: 'Congrats on your first prize', amount: 25 },
]

function RewardsSheet({
  claimed,
  onClose,
  onClaim,
}: {
  claimed: string[]
  onClose: () => void
  onClaim: (reward: Reward) => void
}) {
  const available = REWARDS.filter((r) => !claimed.includes(r.id))
  const total = available.reduce((s, r) => s + r.amount, 0)

  return (
    <SheetShell title="Rewards" onClose={onClose}>
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-teal to-[#155e56] p-4 text-white">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
          <GiftIcon />
        </span>
        <div>
          <p className="text-lg font-extrabold leading-none tabular-nums">
            {inr(total)}
          </p>
          <p className="text-xs text-white/80">
            {available.length
              ? `${available.length} reward${available.length > 1 ? 's' : ''} to claim`
              : 'All rewards claimed 🎉'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {REWARDS.map((r) => {
          const done = claimed.includes(r.id)
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-neutral-100 ${
                done ? 'opacity-60' : ''
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                <GiftIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink leading-tight">{r.title}</p>
                <p className="text-[11px] text-slate">{r.sub}</p>
              </div>
              {done ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-teal [&_svg]:h-4 [&_svg]:w-4">
                  <CheckCircle />
                  Claimed
                </span>
              ) : (
                <button
                  onClick={() => onClaim(r)}
                  className="shrink-0 rounded-lg bg-teal px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition"
                >
                  + {inr(r.amount)}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </SheetShell>
  )
}

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <div className="mt-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button onClick={onClose} className="text-sm font-semibold text-slate">
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
