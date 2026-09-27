import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './routes'
import { SplashScreen } from './components/SplashScreen'
import { Onboarding } from './components/Onboarding'

const ONBOARDED_KEY = 'feedants_onboarded'

export default function App() {
  const [booted, setBooted] = useState(false)
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem(ONBOARDED_KEY) === '1',
  )

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, '1')
    setOnboarded(true)
  }

  return (
    <>
      <RouterProvider router={router} />
      {booted && !onboarded && <Onboarding onDone={finishOnboarding} />}
      {!booted && <SplashScreen onFinish={() => setBooted(true)} />}
    </>
  )
}
