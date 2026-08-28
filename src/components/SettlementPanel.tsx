import { useState } from 'react'
import type { Trip } from '../lib/types'
import type { Entry } from '../lib/types'
import type { MemberWithName } from '../lib/useTripMembers'
import { computeSettlement, type SettlementResult } from '../lib/settlement'
import { SettlementExportModal } from './SettlementExportModal'

interface Props {
  trip: Trip
  members: MemberWithName[]
  entries: Entry[]
  budget: number
}

/**
 * 최종 정산하기.
 *
 * 여행이 끝난 뒤 예산·공금·개인경비 내역을 한 번에 산출해 개인별로
 * 부담해야 할 금액과 이체 방향을 계산한다. 계산 자체는 클라이언트에서
 * 도는 순수 함수(computeSettlement)라 네트워크 요청이 필요 없지만,
 * 버튼 클릭에 반응이 보이도록 짧게 처리 중 상태를 보여준다.
 */
export function SettlementPanel({ trip, members, entries, budget }: Props) {
  const [result, setResult] = useState<SettlementResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  function handleRun() {
    setBusy(true)
    setTimeout(() => {
      const r = computeSettlement(entries, members, budget, trip.treasurer_member_id)
      setResult(r)
      setBusy(false)
    }, 0)
  }

  return (
    <>
      <p className="note" style={{ marginBottom: 12 }}>
        여행이 끝나면 아래의 버튼을 클릭해서 최종 정산을 진행해요. 등록된 예산과 결제내역, 공금 및
        개인 경비 사용내역을 산출해서 개인별로 여행에서 사용한 금액과 정산되어야 하는 금액을 알려드려요.
      </p>

      {!trip.treasurer_member_id && (
        <p className="note" style={{ marginBottom: 9, color: 'var(--marigold)' }}>
          모임통장 관리자가 지정되지 않았어요. 예산 잔여/초과분을 정산에 반영하려면 위 '여행 정보'에서
          먼저 지정해주세요.
        </p>
      )}

      <div className="row2">
        <button className="btn" onClick={handleRun} disabled={busy}>
          {busy ? '정산 중...' : '🧮 최종 정산 진행하기'}
        </button>
        <button className="btn ghost" onClick={() => setModalOpen(true)} disabled={!result}>
          📤 정산내용 내보내기
        </button>
      </div>

      {result && !busy && (
        <p className="note" style={{ marginTop: 9, color: 'var(--jade)' }}>
          최종 정산이 완료되었어요! 정산내용 내보내기 버튼을 클릭해서 내용을 확인해보세요.
        </p>
      )}

      {modalOpen && result && (
        <SettlementExportModal trip={trip} result={result} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
