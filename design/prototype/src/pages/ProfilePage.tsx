import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { CompetitionRow } from '../components/CompetitionRow'
import { competitions, personAvatar } from '../data'
import {
  Bell,
  Camera,
  CheckCircle,
  Chevron,
  Clock,
  Megaphone,
  SectionHeader,
  Shield,
  Star,
  Trophy,
  Upload,
  userImg,
} from '../ui'

type Profile = {
  name: string
  handle: string
  city: string
  bio: string
  email: string
  phone: string
  avatarStyle: string
  avatarUrl?: string // user-uploaded photo (data URL); overrides the generated avatar
}

// Resolve the image to show for a profile: an uploaded photo wins, otherwise a
// deterministic avatar generated from the name + chosen style.
function profileImage(p: Profile): string {
  return p.avatarUrl || personAvatar(p.name || 'Feedants', p.avatarStyle)
}

const badges = [
  { label: 'Top Dancer', icon: <Trophy className="w-5 h-5" />, bg: 'bg-mint text-teal' },
  { label: '5.0 Rated', icon: <Star className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-500' },
  { label: 'Verified', icon: <Shield />, bg: 'bg-indigo-50 text-indigo-400' },
]

type SheetId =
  | 'edit'
  | 'submissions'
  | 'wallet'
  | 'activity'
  | 'help'

type Row = {
  id: string
  label: string
  sub: string
  icon: ReactNode
  tint: string
  to?: string
  sheet?: SheetId
}

const account: Row[] = [
  {
    id: 'submissions',
    label: 'My Submissions',
    sub: '8 entries · 2 wins',
    icon: <Upload />,
    tint: 'bg-mint text-teal',
    to: '/submissions',
  },
  {
    id: 'my-competitions',
    label: 'My Competitions',
    sub: 'Host dashboard · 2 live',
    icon: <Megaphone className="w-5 h-5" />,
    tint: 'bg-teal/10 text-teal',
    to: '/my-competitions',
  },
  {
    id: 'wallet',
    label: 'Wallet & Payments',
    sub: 'Balance, earnings & payouts',
    icon: <Trophy className="w-5 h-5" />,
    tint: 'bg-amber-50 text-amber-500',
    to: '/wallet',
  },
  {
    id: 'refer',
    label: 'Refer & Earn',
    sub: 'Invite friends · earn ₹100 each',
    icon: <Megaphone className="w-5 h-5" />,
    tint: 'bg-teal/10 text-teal',
    to: '/refer',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    sub: '2 unread',
    icon: <Bell />,
    tint: 'bg-rose-50 text-rose-400',
    to: '/notifications',
  },
  {
    id: 'activity',
    label: 'Activity History',
    sub: 'Past competitions',
    icon: <Clock />,
    tint: 'bg-indigo-50 text-indigo-400',
    sheet: 'activity',
  },
]

const settings: Row[] = [
  {
    id: 'account-settings',
    label: 'Account Settings',
    sub: 'Profile, security, privacy',
    icon: <Shield />,
    tint: 'bg-neutral-100 text-slate',
    to: '/settings',
  },
  {
    id: 'help',
    label: 'Help & Support',
    sub: 'FAQs and contact us',
    icon: <Star className="w-5 h-5" />,
    tint: 'bg-neutral-100 text-slate',
    to: '/help',
  },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const myCompetitions = competitions.slice(0, 3)

  const [profile, setProfile] = useState<Profile>({
    name: 'Neha Sharma',
    handle: 'neha.dances',
    city: 'Mumbai',
    bio: 'Classical & contemporary dancer. Competing to grow every day 💃',
    email: 'neha.sharma@email.com',
    phone: '+91 98765 43210',
    avatarStyle: 'avataaars',
    avatarUrl: userImg, // same photo shown in the header + bottom-nav profile tab
  })
  const [sheet, setSheet] = useState<SheetId | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  const openRow = (r: Row) => {
    if (r.to) navigate(r.to)
    else if (r.sheet) setSheet(r.sheet)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <p className="text-slate text-xs">Your account</p>
          <h1 className="text-2xl font-extrabold text-ink leading-tight">
            Profile
          </h1>
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
        {/* Identity card */}
        <div className="relative overflow-hidden rounded-2xl bg-teal text-white p-5 shadow-sm">
          <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-[-32px] w-24 h-24 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            <img
              src={profileImage(profile)}
              alt={profile.name}
              className="w-16 h-16 rounded-2xl object-cover bg-white/20 ring-2 ring-white/40"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-extrabold leading-tight truncate">
                  {profile.name}
                </h2>
                <span className="text-white/90">
                  <Shield />
                </span>
              </div>
              <p className="text-sm text-white/80 truncate">
                @{profile.handle} · {profile.city}
              </p>
            </div>
          </div>

          {profile.bio && (
            <p className="relative mt-3 text-sm text-white/85 leading-snug">
              {profile.bio}
            </p>
          )}

          <div className="relative mt-5 flex items-center justify-between rounded-xl bg-white/15 px-2 py-3">
            {[
              { label: 'Joined', value: '24' },
              { label: 'Wins', value: '06' },
              { label: 'Rank', value: '#128' },
            ].map((s, i, arr) => (
              <div
                key={s.label}
                className={`flex-1 text-center ${
                  i < arr.length - 1 ? 'border-r border-white/20' : ''
                }`}
              >
                <p className="text-lg font-extrabold leading-none">{s.value}</p>
                <p className="text-[11px] text-white/75 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setSheet('edit')}
            className="relative mt-4 w-full rounded-xl bg-white text-teal text-sm font-bold py-2.5 active:scale-[0.99] transition"
          >
            Edit Profile
          </button>
        </div>

        {/* Achievements */}
        <section>
          <SectionHeader title="Achievements" />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {badges.map((b) => (
              <button
                key={b.label}
                onClick={() => setToast(`🏅 Achievement: ${b.label}`)}
                className="shrink-0 flex flex-col items-center gap-2 w-24 rounded-2xl bg-white shadow-sm py-4 active:scale-95 transition"
              >
                <span
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${b.bg}`}
                >
                  {b.icon}
                </span>
                <p className="text-[11px] font-semibold text-ink text-center leading-tight px-1">
                  {b.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Account */}
        <section>
          <SectionHeader title="Account" />
          <MenuGroup rows={account} onOpen={openRow} />
        </section>

        {/* My competitions */}
        <section>
          <SectionHeader
            title="My Competitions"
            action="Host dashboard"
            onAction={() => navigate('/my-competitions')}
          />
          <div className="space-y-3">
            {myCompetitions.map((c) => (
              <CompetitionRow key={c.id} c={c} />
            ))}
          </div>
        </section>

        {/* Settings */}
        <section>
          <SectionHeader title="Settings" />
          <MenuGroup rows={settings} onOpen={openRow} />
        </section>

        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full rounded-2xl bg-white shadow-sm text-rose-500 text-sm font-bold py-3.5 active:scale-[0.99] transition"
        >
          Log Out
        </button>

        <p className="text-center text-[11px] text-slate">Feedants · v1.0.0</p>
      </div>

      {/* Edit profile */}
      <Sheet
        open={sheet === 'edit'}
        title="Edit Profile"
        onClose={() => setSheet(null)}
      >
        <EditProfile
          initial={profile}
          onSave={(p) => {
            setProfile(p)
            setSheet(null)
            setToast('Profile updated')
          }}
        />
      </Sheet>

      {/* My submissions */}
      <Sheet
        open={sheet === 'submissions'}
        title="My Submissions"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-2.5">
          {competitions.slice(0, 5).map((c, i) => {
            const status = i === 0 ? 'Winner' : i < 3 ? 'Judged' : 'In review'
            const tint =
              status === 'Winner'
                ? 'bg-amber-50 text-amber-600'
                : status === 'Judged'
                  ? 'bg-mint text-teal'
                  : 'bg-neutral-100 text-slate'
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSheet(null)
                  navigate(`/competitions/${c.id}`)
                }}
                className="flex items-center gap-3 w-full rounded-2xl bg-white p-3 shadow-sm text-left active:scale-[0.99] transition"
              >
                <img
                  src={c.img}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover bg-mint shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{c.title}</p>
                  <p className="text-xs text-slate mt-0.5">{c.tag}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tint}`}
                >
                  {status}
                </span>
              </button>
            )
          })}
        </div>
      </Sheet>

      {/* Activity history */}
      <Sheet
        open={sheet === 'activity'}
        title="Activity History"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-2.5">
          {competitions.slice(3, 9).map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
            >
              <span className="w-9 h-9 rounded-xl bg-mint text-teal flex items-center justify-center shrink-0">
                <Clock />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-sm truncate">{c.title}</p>
                <p className="text-xs text-slate mt-0.5">
                  {i % 2 === 0 ? 'Participated' : 'Registered'} ·{' '}
                  {c.tag}
                </p>
              </div>
              <span className="text-[11px] text-slate shrink-0">
                {i + 2}d ago
              </span>
            </div>
          ))}
        </div>
      </Sheet>

      {/* Log out confirm */}
      {logoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-8">
          <div
            onClick={() => setLogoutOpen(false)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-[300px] rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-extrabold text-ink">Log out?</h3>
            <p className="mt-1 text-sm text-slate">
              You'll need to sign in again to continue.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setLogoutOpen(false)}
                className="flex-1 rounded-xl bg-neutral-100 py-3 text-sm font-bold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setLogoutOpen(false)
                  navigate('/login')
                }}
                className="flex-1 rounded-xl bg-rose-500 py-3 text-sm font-bold text-white"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 bottom-24 z-[80] -translate-x-1/2">
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

function MenuGroup({
  rows,
  onOpen,
}: {
  rows: Row[]
  onOpen: (r: Row) => void
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
      {rows.map((r) => (
        <button
          key={r.id}
          onClick={() => onOpen(r)}
          className="flex items-center gap-3 w-full px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl active:bg-neutral-50 transition"
        >
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.tint}`}
          >
            {r.icon}
          </span>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-bold text-ink text-sm leading-tight">{r.label}</p>
            <p className="text-xs text-slate mt-0.5">{r.sub}</p>
          </div>
          <Chevron className="-rotate-90 w-4 h-4 text-slate" />
        </button>
      ))}
    </div>
  )
}

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
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
        className={`relative w-full max-w-[430px] max-h-[82vh] overflow-y-auto no-scrollbar rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between mt-3 mb-4">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate text-sm font-semibold"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Avatar styles the user can switch between; all seeded by their name so the
// picture stays tied to their identity.
const AVATAR_STYLES = ['avataaars', 'micah', 'notionists', 'adventurer', 'lorelei', 'fun-emoji']

const BIO_MAX = 120

function EditProfile({
  initial,
  onSave,
}: {
  initial: Profile
  onSave: (p: Profile) => void
}) {
  const [form, setForm] = useState<Profile>(initial)
  const set =
    (k: keyof Profile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB')
      return
    }
    setUploadError('')
    const reader = new FileReader()
    reader.onload = () =>
      setForm((f) => ({ ...f, avatarUrl: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const inputCls =
    'w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal'

  // Validation.
  const handle = form.handle.replace(/^@+/, '')
  const errors = {
    name: !form.name.trim() ? 'Name is required' : '',
    handle: !/^[a-z0-9_.]{3,}$/i.test(handle)
      ? '3+ letters, numbers, dot or underscore'
      : '',
    email:
      form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
        ? 'Enter a valid email'
        : '',
  }
  const valid = !errors.name && !errors.handle && !errors.email

  return (
    <div className="space-y-4">
      {/* Avatar + upload + style picker */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img
            src={profileImage(form)}
            alt=""
            className="w-24 h-24 rounded-3xl object-cover bg-mint ring-2 ring-white shadow"
          />
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Upload photo"
            className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center shadow-md ring-2 ring-white"
          >
            <Camera />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />

        {uploadError && (
          <p className="text-[11px] font-medium text-rose-500">{uploadError}</p>
        )}

        <p className="text-xs font-semibold text-slate">
          {form.avatarUrl ? 'Or choose an avatar' : 'Choose your look'}
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full justify-center px-1">
          {AVATAR_STYLES.map((style) => {
            const active = !form.avatarUrl && style === form.avatarStyle
            return (
              <button
                key={style}
                onClick={() =>
                  setForm((f) => ({ ...f, avatarStyle: style, avatarUrl: undefined }))
                }
                className={`shrink-0 rounded-2xl p-0.5 transition ${
                  active ? 'ring-2 ring-teal' : 'ring-1 ring-neutral-200'
                }`}
              >
                <img
                  src={personAvatar(form.name || 'Feedants', style)}
                  alt={style}
                  className="w-11 h-11 rounded-[14px] object-cover bg-mint"
                />
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Full name" error={errors.name}>
        <input className={inputCls} value={form.name} onChange={set('name')} />
      </Field>

      <Field label="Username" error={errors.handle}>
        <div className="flex items-center rounded-xl bg-white ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-teal">
          <span className="pl-3.5 text-sm text-slate">@</span>
          <input
            className="flex-1 bg-transparent px-1.5 py-3 text-sm text-ink outline-none"
            value={handle}
            onChange={(e) =>
              setForm((f) => ({ ...f, handle: e.target.value.replace(/\s/g, '') }))
            }
          />
        </div>
      </Field>

      <Field label="City">
        <input className={inputCls} value={form.city} onChange={set('city')} />
      </Field>

      <Field label="Bio">
        <textarea
          rows={3}
          maxLength={BIO_MAX}
          className={`${inputCls} resize-none`}
          value={form.bio}
          onChange={set('bio')}
          placeholder="Tell others about yourself"
        />
        <p className="mt-1 text-right text-[11px] text-slate">
          {form.bio.length}/{BIO_MAX}
        </p>
      </Field>

      <Field label="Email" error={errors.email}>
        <input
          type="email"
          className={inputCls}
          value={form.email}
          onChange={set('email')}
        />
      </Field>

      <Field label="Phone">
        <input
          type="tel"
          className={inputCls}
          value={form.phone}
          onChange={set('phone')}
        />
      </Field>

      <button
        onClick={() => onSave({ ...form, handle })}
        disabled={!valid}
        className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 disabled:opacity-60"
      >
        Save changes
      </button>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-[11px] font-medium text-rose-500">{error}</p>}
    </div>
  )
}
