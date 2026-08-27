import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { TripProvider, useTrip } from './context/TripContext'
import { CodeGate } from './pages/CodeGate'
import { CreateTripForm } from './pages/CreateTripForm'
import { NameGate } from './pages/NameGate'
import { TripLayout } from './pages/TripLayout'
import { HomeTab } from './pages/HomeTab'
import { RecordTab } from './pages/RecordTab'
import { HistoryTab } from './pages/HistoryTab'
import { SettingsTab } from './pages/SettingsTab'

function Gate() {
  const { loading, trip, personName, connectTrip } = useTrip()
  const [showCreateForm, setShowCreateForm] = useState(false)

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
    if (showCreateForm) {
      return (
        <CreateTripForm
          onBack={() => setShowCreateForm(false)}
          onCreated={(code) => {
            setShowCreateForm(false)
            connectTrip(code)
          }}
        />
      )
    }
    return <CodeGate onCreateTrip={() => setShowCreateForm(true)} />
  }
  if (!personName) return <NameGate />

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
    <TripProvider>
      <Gate />
    </TripProvider>
  )
}

export default App
