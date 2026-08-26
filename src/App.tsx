import { Route, Routes } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { TripLayout } from './pages/TripLayout'
import { RecordTab } from './pages/RecordTab'
import { HistoryTab } from './pages/HistoryTab'
import { SettingsTab } from './pages/SettingsTab'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/t/:code" element={<TripLayout />}>
        <Route index element={<RecordTab />} />
        <Route path="history" element={<HistoryTab />} />
        <Route path="settings" element={<SettingsTab />} />
      </Route>
    </Routes>
  )
}

export default App
