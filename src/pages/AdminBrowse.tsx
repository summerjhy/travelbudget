import { useEffect, useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import { listTrips, type AdminTrip } from '../lib/adminTrips'
import { Collapsible } from '../components/Collapsible'
import { dateInZone, tripPhaseOf, type TripPhase } from '../lib/tripDate'

const GROUPS: { key: TripPhase; label: string }[] = [
  { key: 'ongoing', label: '🟢 진행중인 여행' },
  { key: 'upcoming', label: '🗓 준비중인 여행' },
  { key: 'ended', label: '✅ 종료된 여행' },
]

/**
 * 관리자 여행 둘러보기.
 *
 * 코드를 몰라도 아무 여행이나 열 수 있다. 홈 화면의 여행 목록과 같은
 * 3그룹 구성이지만, 여기서는 실제로 그 여행에 들어갈 수 있다 —
 * 관리자 함수가 코드까지 내려주기 때문이다.
 */
export function AdminBrowse({
  onEnter,
  onBack,
}: {
  onEnter: (code: string) => void
  onBack: () => void
}) {
  const { password } = useAdmin()
  const [trips, setTrips] = useState<AdminTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<AdminTrip | null>(null)

  useEffect(() => {
    if (!password) return
    let alive = true
    listTrips(password).then((r) => {
      if (!alive) return
      if (r.ok) setTrips(r.data.trips)
      else setError(r.error)
      setLoading(false)
    })
    return () => { alive = false }
  }, [password])

  // 여행마다 자기 시간대로 오늘을 따져 단계를 정한다.
  function phaseOf(t: AdminTrip): TripPhase {
    const today = dateInZone(new Date(), t.tz || 'Asia/Seoul')
    return tripPhaseOf(t.start_date, t.end_date, today)
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="headrow">
          <h1 className="title">🧭 여행 둘러보기</h1>
          <div className="eyebrow">{trips.length}개</div>
        </div>
        <div className="remain">
          <span><span>코드 없이 아무 여행이나 열 수 있어요</span></span>
        </div>
      </header>

      <div className="pad">
        <button className="btn quiet" style={{ marginBottom: 12 }} onClick={onBack}>돌아가기</button>

        {loading && <p className="note">불러오는 중...</p>}
        {error && <p className="err">{error}</p>}

        {confirming && (
          <div className="prev edit" style={{ marginBottom: 12 }}>
            <p className="note" style={{ margin: '0 0 10px' }}>
              <b>'{confirming.name}'</b> 여행을 둘러보시겠어요?
            </p>
            <div className="editrow">
              <button
                className="btn quiet sm"
                style={{ flex: '0 0 34%' }}
                onClick={() => setConfirming(null)}
              >
                아니오
              </button>
              <button className="btn sm" onClick={() => onEnter(confirming.code)}>네, 들어갈래요</button>
            </div>
          </div>
        )}

        {!loading && trips.length === 0 && <div className="empty">아직 만들어진 여행이 없어요.</div>}

        {!loading && GROUPS.map(({ key, label }) => {
          const list = trips.filter((t) => phaseOf(t) === key)
          if (list.length === 0) return null
          return (
            <Collapsible key={key} title={`${label} · ${list.length}개`} defaultOpen={key === 'ongoing'}>
              {list.map((t) => (
                <button
                  key={t.id}
                  className="tr"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => setConfirming(t)}
                >
                  <span className="k" style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.name}</span>
                  <span className="v txt" style={{ color: 'var(--jade)' }}>둘러보기 →</span>
                </button>
              ))}
            </Collapsible>
          )
        })}
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
