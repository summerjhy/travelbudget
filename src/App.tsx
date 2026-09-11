import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { TripProvider, useTrip } from './context/TripContext'
import { getOnboarded, setOnboarded } from './lib/session'
import { CodeGate } from './pages/CodeGate'
import { CreateTripForm } from './pages/CreateTripForm'
import { AdminConsole } from './pages/AdminConsole'
import { AdminGate } from './pages/AdminGate'
import { AdminMenu } from './pages/AdminMenu'
import { AdminBrowse } from './pages/AdminBrowse'
import { AdminProvider, useAdmin } from './context/AdminContext'
import { NameGate } from './pages/NameGate'
import { Onboarding } from './pages/Onboarding'
import { TripLayout } from './pages/TripLayout'
import { HomeTab } from './pages/HomeTab'
import { RecordTab } from './pages/RecordTab'
import { HistoryTab } from './pages/HistoryTab'
import { SettingsTab } from './pages/SettingsTab'

type AdminView = 'menu' | 'create' | 'browse' | 'manage'

function Gate() {
  const { loading, trip, personName, connectTrip } = useTrip()
  const { authed } = useAdmin()
  // null 이면 관리자 화면이 아니다. 인증 전에는 AdminGate 가 대신 뜬다.
  const [adminView, setAdminView] = useState<AdminView | null>(null)
  const [onboarded, setOnboardedState] = useState(getOnboarded)

  if (loading) {
    return (
      <div className="wrap">
        <div className="pad" style={{ paddingTop: 40 }}>
          <p className="note">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    if (adminView !== null) {
      if (!authed) return <AdminGate onBack={() => setAdminView(null)} />
      if (adminView === 'create') {
        return (
          <CreateTripForm
            onBack={() => setAdminView('menu')}
            onCreated={(code) => {
              setAdminView(null)
              connectTrip(code)
            }}
          />
        )
      }
      if (adminView === 'browse') {
        return (
          <AdminBrowse
            onBack={() => setAdminView('menu')}
            onEnter={(code) => {
              setAdminView(null)
              connectTrip(code)
            }}
          />
        )
      }
      if (adminView === 'manage') {
        return (
          <AdminConsole
            onBack={() => setAdminView('menu')}
            onCreateTrip={() => setAdminView('create')}
          />
        )
      }
      return (
        <AdminMenu
          onCreateTrip={() => setAdminView('create')}
          onBrowse={() => setAdminView('browse')}
          onManage={() => setAdminView('manage')}
          onBack={() => setAdminView(null)}
        />
      )
    }
    return <CodeGate onAdmin={() => setAdminView('menu')} />
  }
  if (!personName) return <NameGate />
  // 이름까지 넣은 다음 딱 한 번. 설치 안내와 사용법을 여기서 보여준다.
  if (!onboarded) {
    return (
      <Onboarding
        onDone={() => {
          setOnboarded(true)
          setOnboardedState(true)
        }}
      />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<TripLayout />}>
        <Route index element={<HomeTab />} />
        <Route path="record" element={<RecordTab />} />
        <Route path="history" element={<HistoryTab />} />
        <Route path="settings" element={<SettingsTab />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AdminProvider>
      <TripProvider>
        <Gate />
      </TripProvider>
    </AdminProvider>
  )
}

export default App
