import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Chat,
  CheckCircle,
  Chevron,
  Mail,
  PageHeader,
  Phone,
  SearchIcon,
} from '../ui'

const FAQS = [
  {
    cat: 'Submissions',
    q: 'How do I submit an entry?',
    a: 'Open the competition, tap “Upload Submission” on the sticky bar, then choose your file or paste a link. You can replace it any time before submissions close.',
  },
  {
    cat: 'Results',
    q: 'When are winners announced?',
    a: 'Results go live on each competition’s Result Date, shown under Important Dates. You’ll also get a push notification the moment they’re out.',
  },
  {
    cat: 'Payments',
    q: 'How do prize payouts work?',
    a: 'Winnings are credited to your in-app Wallet within 48 hours of results. From Wallet & Payments you can withdraw to any UPI ID or bank account.',
  },
  {
    cat: 'Payments',
    q: 'How do I get a refund?',
    a: 'Entry fees are refundable up until a competition starts. Go to Wallet & Payments → the entry transaction → Request refund, and it’s processed within 5–7 business days.',
  },
  {
    cat: 'Account',
    q: 'How do I change my language or delete my account?',
    a: 'Head to Settings from your Profile. You’ll find language preferences under Preferences, and account deletion at the bottom of the screen.',
  },
  {
    cat: 'Security',
    q: 'Is my payment secure?',
    a: 'Yes. All payments are processed over an encrypted connection via Razorpay. Feedants never stores your card or UPI credentials.',
  },
]

export default function HelpPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'browse' | 'form'>('browse')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  const results = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(query.toLowerCase()) ||
      f.a.toLowerCase().includes(query.toLowerCase()),
  )

  const channels = [
    {
      id: 'chat',
      label: 'Live chat',
      sub: 'Avg. reply 2 min',
      icon: <Chat />,
      tint: 'bg-mint text-teal',
      msg: 'Live chat opening…',
    },
    {
      id: 'email',
      label: 'Email us',
      sub: 'help@feedants.com',
      icon: <Mail />,
      tint: 'bg-indigo-50 text-indigo-400',
      msg: 'Opening your email app…',
    },
    {
      id: 'call',
      label: 'Call us',
      sub: 'Mon–Sat · 9–7',
      icon: <Phone />,
      tint: 'bg-amber-50 text-amber-500',
      msg: 'Dialing support…',
    },
  ]

  return (
    <>
      <PageHeader title="Help & Support" subtitle="We're here to help" />

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-16 space-y-6"
        data-scroll
      >
        {mode === 'form' ? (
          <ContactForm
            onBack={() => setMode('browse')}
            onSent={() => {
              setMode('browse')
            }}
          />
        ) : (
          <>
            {/* Search */}
            <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 shadow-sm">
              <span className="text-slate">
                <SearchIcon className="w-5 h-5" />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help articles"
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-slate text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Contact channels */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
                Contact us
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {channels.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setToast(c.msg)}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white shadow-sm py-4 active:scale-95 transition"
                  >
                    <span
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.tint}`}
                    >
                      {c.icon}
                    </span>
                    <span className="text-[11px] font-bold text-ink">
                      {c.label}
                    </span>
                    <span className="text-[9px] text-slate text-center leading-tight px-1">
                      {c.sub}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
                {query
                  ? `${results.length} result${results.length === 1 ? '' : 's'}`
                  : 'Frequently asked'}
              </h2>
              <div className="space-y-2">
                {results.map((f) => (
                  <Faq key={f.q} q={f.q} a={f.a} cat={f.cat} />
                ))}
                {results.length === 0 && (
                  <div className="rounded-2xl bg-white shadow-sm py-8 text-center">
                    <p className="text-sm text-slate px-6">
                      No articles match “{query}”. Try messaging our team below.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Still need help */}
            <div className="rounded-2xl bg-mint p-4 text-center">
              <p className="text-sm font-bold text-ink">Still need help?</p>
              <p className="text-xs text-slate mt-0.5">
                Send us a message and we'll get back within a few hours.
              </p>
              <button
                onClick={() => setMode('form')}
                className="mt-3 w-full rounded-xl bg-teal text-white text-sm font-bold py-3"
              >
                Send us a message
              </button>
            </div>

            {/* Legal shortcuts */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
                More
              </h2>
              <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
                {[
                  { label: 'About Feedants', to: '/about' },
                  { label: 'Terms & Conditions', to: '/legal/terms' },
                  { label: 'Privacy Policy', to: '/legal/privacy' },
                ].map((r) => (
                  <button
                    key={r.to}
                    onClick={() => navigate(r.to)}
                    className="flex items-center justify-between w-full px-4 py-3.5 first:rounded-t-2xl last:rounded-b-2xl active:bg-neutral-50 transition"
                  >
                    <span className="text-sm font-bold text-ink">{r.label}</span>
                    <Chevron className="-rotate-90 w-4 h-4 text-slate" />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 bottom-10 z-[80] -translate-x-1/2 px-4 w-full max-w-[430px]">
          <div className="mx-auto flex w-max max-w-full items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            <span className="text-teal-300">
              <CheckCircle />
            </span>
            {toast}
          </div>
        </div>
      )}
    </>
  )
}

function Faq({ q, a, cat }: { q: string; a: string; cat: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-start justify-between gap-3 w-full px-4 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="inline-block rounded-md bg-mint text-teal text-[10px] font-bold px-2 py-0.5 mb-1.5">
            {cat}
          </span>
          <span className="block text-sm font-semibold text-ink leading-snug">
            {q}
          </span>
        </span>
        <Chevron
          className={`w-4 h-4 text-slate transition shrink-0 mt-0.5 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <p className="px-4 pb-3.5 -mt-1 text-xs text-slate leading-relaxed">
          {a}
        </p>
      )}
    </div>
  )
}

const TOPICS = [
  'Account & profile',
  'Submissions',
  'Payments & refunds',
  'Report a bug',
  'Something else',
]

function ContactForm({
  onBack,
  onSent,
}: {
  onBack: () => void
  onSent: () => void
}) {
  const [topic, setTopic] = useState(TOPICS[0])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const inputCls =
    'w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal'

  if (sent) {
    return (
      <div className="rounded-2xl bg-white shadow-sm py-10 text-center">
        <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-mint text-teal [&_svg]:w-8 [&_svg]:h-8">
          <CheckCircle />
        </span>
        <h4 className="mt-4 text-lg font-extrabold text-ink">Message sent</h4>
        <p className="mt-1 text-sm text-slate px-6">
          Our team will reply within a few hours. Ticket #FD-
          {Math.floor(1000 + Math.random() * 9000)}
        </p>
        <button
          onClick={onSent}
          className="mt-5 rounded-xl bg-teal px-6 py-3 text-sm font-bold text-white"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold text-teal"
      >
        <Chevron className="rotate-90 w-4 h-4" /> Back to help
      </button>

      <div>
        <label className="text-xs font-semibold text-slate">Topic</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const active = t === topic
            return (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-teal text-white'
                    : 'bg-white text-slate ring-1 ring-neutral-200'
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate">Subject</label>
        <input
          className={`mt-1 ${inputCls}`}
          placeholder="What do you need help with?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate">Message</label>
        <textarea
          rows={6}
          className={`mt-1 ${inputCls} resize-none`}
          placeholder="Describe your issue in detail…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <button
        onClick={() => setSent(true)}
        disabled={!subject.trim() || !message.trim()}
        className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 disabled:opacity-60"
      >
        Send message
      </button>
    </div>
  )
}
