import { useLayoutEffect } from 'react'
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Outlet,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router'
import CompetitionsPage from './pages/CompetitionsPage'
import ExplorePage from './pages/ExplorePage'
import HomePage from './pages/HomePage'
import HostPage from './pages/HostPage'
import LeaderboardPage from './pages/LeaderboardPage'
import WalletPage from './pages/WalletPage'
import SearchPage from './pages/SearchPage'
import ListPage from './pages/ListPage'
import MySubmissionsPage from './pages/MySubmissionsPage'
import MyCompetitionsPage from './pages/MyCompetitionsPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import OtpVerificationPage from './pages/OtpVerificationPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LivePage from './pages/LivePage'
import NotificationsPage from './pages/NotificationsPage'
import MessagesPage from './pages/MessagesPage'
import ChatThreadPage from './pages/ChatThreadPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import HelpPage from './pages/HelpPage'
import AboutPage from './pages/AboutPage'
import { TermsPage, PrivacyPage } from './pages/LegalPage'
import WinnerProfilePage from './pages/WinnerProfilePage'
import ReferPage from './pages/ReferPage'
import { BottomNav } from './components/BottomNav'
import { OfflineBanner } from './components/OfflineBanner'

function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document
      .querySelectorAll<HTMLElement>('[data-scroll]')
      .forEach((el) => (el.scrollTop = 0))
  }, [pathname])
  return null
}

function Shell() {
  return (
    <div className="min-h-screen w-full bg-canvas flex justify-center">
      <div className="relative w-full max-w-[430px] bg-canvas min-h-screen flex flex-col">
        <ScrollToTop />
        <OfflineBanner />
        <Outlet />
      </div>
    </div>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-2">
        <h1 className="text-xl font-extrabold text-ink">{title}</h1>
        <p className="text-sm text-slate">This screen is coming soon.</p>
      </div>
      <BottomNav />
    </>
  )
}

function ErrorScreen() {
  const error = useRouteError()
  const navigate = useNavigate()
  const is404 = isRouteErrorResponse(error) && error.status === 404
  const title = is404 ? 'Page not found' : 'Something went wrong'
  const message = is404
    ? "The competition or page you're looking for doesn't exist."
    : 'An unexpected error occurred. Please try again.'

  return (
    <div className="min-h-screen w-full bg-canvas flex justify-center">
      <div className="relative w-full max-w-[430px] bg-canvas min-h-screen flex flex-col items-center justify-center text-center px-8 gap-3">
        <span className="w-16 h-16 rounded-2xl bg-mint text-teal flex items-center justify-center text-3xl font-extrabold">
          {is404 ? '?' : '!'}
        </span>
        <h1 className="text-xl font-extrabold text-ink">{title}</h1>
        <p className="text-sm text-slate max-w-[280px]">{message}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 rounded-xl bg-teal text-white text-sm font-semibold px-5 py-2.5"
        >
          Back to home
        </button>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Shell,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, Component: HomePage },
      { path: 'login', Component: LoginPage },
      { path: 'signup', Component: SignUpPage },
      { path: 'verify', Component: OtpVerificationPage },
      { path: 'forgot-password', Component: ForgotPasswordPage },
      { path: 'competitions', Component: CompetitionsPage },
      { path: 'competitions/:id', Component: CompetitionsPage },
      { path: 'competitions/:id/results', Component: LeaderboardPage },
      { path: 'search', Component: SearchPage },
      { path: 'wallet', Component: WalletPage },
      { path: 'refer', Component: ReferPage },
      { path: 'explore', Component: ExplorePage },
      { path: 'explore/:type', Component: ListPage },
      { path: 'notifications', Component: NotificationsPage },
      { path: 'messages', Component: MessagesPage },
      { path: 'messages/:id', Component: ChatThreadPage },
      { path: 'host', Component: HostPage },
      { path: 'submissions', Component: MySubmissionsPage },
      { path: 'my-competitions', Component: MyCompetitionsPage },
      { path: 'live', Component: LivePage },
      { path: 'profile', Component: ProfilePage },
      { path: 'settings', Component: SettingsPage },
      { path: 'help', Component: HelpPage },
      { path: 'about', Component: AboutPage },
      { path: 'legal/terms', Component: TermsPage },
      { path: 'legal/privacy', Component: PrivacyPage },
      { path: 'winners/:name', Component: WinnerProfilePage },
      { path: '*', Component: () => <ComingSoon title="Not Found" /> },
    ],
  },
])
