import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Bell,
  Chat,
  CheckCircle,
  Chevron,
  Globe,
  Info,
  Lock,
  Mail,
  Moon,
  Phone,
  Shield,
  Trash,
  userImg,
} from '../ui'

/* ------------------------------------------------------------------ *
 * Settings — a dedicated, native-feeling settings screen.
 * Grouped rows, inline toggles, a language picker sheet, and a
 * destructive delete-account flow that requires typed confirmation.
 * ------------------------------------------------------------------ */

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
]

type SheetId = 'language' | 'password' | null

export default function SettingsPage() {
  const navigate = useNavigate()

  const [lang, setLang] = useState('en')
  const [sheet, setSheet] = useState<SheetId>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Preference toggles — persisted to state for the session.
  const [prefs, setPrefs] = useState({
    push: true,
    email: false,
    results: true,
    darkMode: false,
    privateProfile: false,
    activityStatus: true,
    personalizedAds: false,
    twoFactor: true,
  })
  const toggle = (k: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [k]: !p[k] }))

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  const activeLang = LANGUAGES.find((l) => l.code === lang)!

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink active:scale-95 transition"
        >
          <ArrowLeft />
        </button>
        <div>
          <p className="text-slate text-xs">Manage your app</p>
          <h1 className="text-2xl font-extrabold text-ink leading-tight">
            Settings
          </h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-16 space-y-6"
        data-scroll
      >
        {/* Account card */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3.5 w-full rounded-2xl bg-white p-3.5 shadow-sm text-left active:scale-[0.99] transition"
        >
          <img
            src={userImg}
            alt="Neha Sharma"
            className="w-14 h-14 rounded-2xl object-cover bg-mint"
          />
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-ink leading-tight truncate">
              Neha Sharma
            </p>
            <p className="text-xs text-slate mt-0.5 truncate">
              @neha.dances · View profile
            </p>
          </div>
          <Chevron className="-rotate-90 w-4 h-4 text-slate shrink-0" />
        </button>

        {/* Account */}
        <Group title="Account">
          <NavRow
            icon={<Mail />}
            tint="bg-mint text-teal"
            label="Email address"
            value="neha.sharma@email.com"
            onClick={() => setToast('Email is managed from Edit Profile')}
          />
          <NavRow
            icon={<Phone />}
            tint="bg-indigo-50 text-indigo-400"
            label="Phone number"
            value="+91 98765 43210"
            onClick={() => setToast('Phone is managed from Edit Profile')}
          />
          <NavRow
            icon={<Lock />}
            tint="bg-amber-50 text-amber-500"
            label="Password"
            value="Last changed 3 months ago"
            onClick={() => setSheet('password')}
          />
          <ToggleRow
            icon={<Shield />}
            tint="bg-rose-50 text-rose-400"
            label="Two-factor authentication"
            sub="Extra security at login"
            on={prefs.twoFactor}
            onToggle={() => toggle('twoFactor')}
          />
        </Group>

        {/* Preferences — language default lives here */}
        <Group title="Preferences">
          <NavRow
            icon={<Globe />}
            tint="bg-teal/10 text-teal"
            label="Language"
            value={`${activeLang.label} · ${activeLang.native}`}
            onClick={() => setSheet('language')}
          />
          <ToggleRow
            icon={<Moon />}
            tint="bg-neutral-100 text-slate"
            label="Dark mode"
            sub="Easier on the eyes at night"
            on={prefs.darkMode}
            onToggle={() => {
              toggle('darkMode')
              setToast(prefs.darkMode ? 'Dark mode off' : 'Dark mode on')
            }}
          />
        </Group>

        {/* Notifications */}
        <Group title="Notifications">
          <ToggleRow
            icon={<Bell />}
            tint="bg-mint text-teal"
            label="Push notifications"
            sub="Alerts on this device"
            on={prefs.push}
            onToggle={() => toggle('push')}
          />
          <ToggleRow
            icon={<Mail />}
            tint="bg-indigo-50 text-indigo-400"
            label="Email updates"
            sub="Weekly digest & news"
            on={prefs.email}
            onToggle={() => toggle('email')}
          />
          <ToggleRow
            icon={<CheckCircle />}
            tint="bg-amber-50 text-amber-500"
            label="Results & winners"
            sub="When a competition wraps up"
            on={prefs.results}
            onToggle={() => toggle('results')}
          />
        </Group>

        {/* Privacy */}
        <Group title="Privacy">
          <ToggleRow
            icon={<Lock />}
            tint="bg-neutral-100 text-slate"
            label="Private profile"
            sub="Hide your entries from others"
            on={prefs.privateProfile}
            onToggle={() => toggle('privateProfile')}
          />
          <ToggleRow
            icon={<Shield />}
            tint="bg-neutral-100 text-slate"
            label="Show activity status"
            sub="Let others see when you're online"
            on={prefs.activityStatus}
            onToggle={() => toggle('activityStatus')}
          />
          <ToggleRow
            icon={<Globe />}
            tint="bg-neutral-100 text-slate"
            label="Personalized ads"
            sub="Use your activity to tailor ads"
            on={prefs.personalizedAds}
            onToggle={() => toggle('personalizedAds')}
          />
          <NavRow
            icon={<Shield />}
            tint="bg-neutral-100 text-slate"
            label="Download my data"
            value="Get a copy of your information"
            onClick={() => setToast("We'll email your data export soon")}
          />
        </Group>

        {/* Support & About */}
        <Group title="Support & About">
          <NavRow
            icon={<Chat />}
            tint="bg-mint text-teal"
            label="Help & Support"
            value="FAQ, contact us"
            onClick={() => navigate('/help')}
          />
          <NavRow
            icon={<Info />}
            tint="bg-indigo-50 text-indigo-400"
            label="About Feedants"
            value="Our story & mission"
            onClick={() => navigate('/about')}
          />
          <NavRow
            label="Terms & Conditions"
            onClick={() => navigate('/legal/terms')}
          />
          <NavRow
            label="Privacy Policy"
            onClick={() => navigate('/legal/privacy')}
          />
          <NavRow
            label="App version"
            value="1.0.0 (build 128)"
            chevron={false}
          />
        </Group>

        {/* Danger zone */}
        <div className="space-y-3">
          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full rounded-2xl bg-white shadow-sm text-ink text-sm font-bold py-3.5 active:scale-[0.99] transition"
          >
            Log Out
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-rose-50 text-rose-500 text-sm font-bold py-3.5 active:scale-[0.99] transition"
          >
            <Trash />
            Delete Account
          </button>
        </div>

        <p className="text-center text-[11px] text-slate">
          Feedants · Made in India 🇮🇳
        </p>
      </div>

      {/* Language picker */}
      <Sheet
        open={sheet === 'language'}
        title="Language"
        onClose={() => setSheet(null)}
      >
        <p className="text-xs text-slate mb-3 -mt-1">
          Choose the default language for the app.
        </p>
        <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code)
                  setSheet(null)
                  setToast(`Language set to ${l.label}`)
                }}
                className="flex items-center gap-3 w-full px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl active:bg-neutral-50 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-sm leading-tight">
                    {l.label}
                  </p>
                  <p className="text-xs text-slate mt-0.5">{l.native}</p>
                </div>
                {active && (
                  <span className="text-teal shrink-0">
                    <CheckCircle />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Sheet>

      {/* Change password */}
      <Sheet
        open={sheet === 'password'}
        title="Change Password"
        onClose={() => setSheet(null)}
      >
        <ChangePassword
          onSave={() => {
            setSheet(null)
            setToast('Password updated')
          }}
        />
      </Sheet>

      {/* Log out confirm */}
      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        message="You'll need to sign in again to continue."
        confirmLabel="Log out"
        confirmClass="bg-rose-500 text-white"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false)
          navigate('/login')
        }}
      />

      {/* Delete account — typed confirmation */}
      {deleteOpen && (
        <DeleteAccount
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false)
            navigate('/signup')
          }}
        />
      )}

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

/* ---------- building blocks ---------- */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-white shadow-sm divide-y divide-neutral-100">
        {children}
      </div>
    </section>
  )
}

function NavRow({
  icon,
  tint,
  label,
  value,
  onClick,
  chevron = true,
}: {
  icon?: ReactNode
  tint?: string
  label: string
  value?: string
  onClick?: () => void
  chevron?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl ${
        onClick ? 'active:bg-neutral-50 transition' : ''
      }`}
    >
      {icon && (
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint} [&_svg]:w-[18px] [&_svg]:h-[18px]`}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-sm leading-tight">{label}</p>
        {value && <p className="text-xs text-slate mt-0.5 truncate">{value}</p>}
      </div>
      {chevron && onClick && (
        <Chevron className="-rotate-90 w-4 h-4 text-slate shrink-0" />
      )}
    </Tag>
  )
}

function ToggleRow({
  icon,
  tint,
  label,
  sub,
  on,
  onToggle,
}: {
  icon: ReactNode
  tint: string
  label: string
  sub: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint} [&_svg]:w-[18px] [&_svg]:h-[18px]`}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-sm leading-tight">{label}</p>
        <p className="text-xs text-slate mt-0.5">{sub}</p>
      </div>
      <button
        onClick={onToggle}
        aria-pressed={on}
        aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          on ? 'bg-teal' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
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
          <button onClick={onClose} className="text-slate text-sm font-semibold">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmClass,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmClass: string
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-8">
      <div
        onClick={onCancel}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-[300px] rounded-3xl bg-white p-6 text-center shadow-2xl">
        <h3 className="text-lg font-extrabold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-slate">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-neutral-100 py-3 text-sm font-bold text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangePassword({ onSave }: { onSave: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const inputCls =
    'w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal'

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && confirm !== next
  const valid = current && next.length >= 8 && confirm === next

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate">
          Current password
        </label>
        <input
          type="password"
          className={`mt-1 ${inputCls}`}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate">New password</label>
        <input
          type="password"
          className={`mt-1 ${inputCls}`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="At least 8 characters"
        />
        {tooShort && (
          <p className="mt-1 text-[11px] font-medium text-rose-500">
            Use at least 8 characters
          </p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate">
          Confirm new password
        </label>
        <input
          type="password"
          className={`mt-1 ${inputCls}`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
        />
        {mismatch && (
          <p className="mt-1 text-[11px] font-medium text-rose-500">
            Passwords don't match
          </p>
        )}
      </div>
      <button
        onClick={onSave}
        disabled={!valid}
        className="w-full rounded-xl bg-teal text-white text-sm font-bold py-3.5 disabled:opacity-60"
      >
        Update password
      </button>
    </div>
  )
}

// Delete flow gated behind typing the exact confirmation word — mirrors how
// real apps guard irreversible destruction.
function DeleteAccount({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const armed = text.trim().toUpperCase() === 'DELETE'

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div onClick={onCancel} className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <div className="mt-5 flex flex-col items-center text-center">
          <span className="flex w-14 h-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 [&_svg]:w-6 [&_svg]:h-6">
            <Trash />
          </span>
          <h3 className="mt-3 text-lg font-extrabold text-ink">
            Delete your account?
          </h3>
          <p className="mt-1 text-sm text-slate px-2">
            This permanently erases your profile, submissions, wallet balance and
            competition history. This action can't be undone.
          </p>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-slate">
            Type <span className="font-extrabold text-rose-500">DELETE</span> to
            confirm
          </label>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            className="mt-1 w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-rose-400"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-neutral-100 py-3.5 text-sm font-bold text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!armed}
            className="flex-1 rounded-xl bg-rose-500 py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Delete forever
          </button>
        </div>
      </div>
    </div>
  )
}
