import { useState } from 'react'
import type { Trip } from '../lib/types'
import type { SettlementResult } from '../lib/settlement'
import { settlementToCsv, settlementToText, settlementFileName } from '../lib/settlementExport'
import { deliverFile, deliverText, type DeliverResult } from '../lib/export'

interface Props {
  trip: Trip
  result: SettlementResult
  onClose: () => void
}

const RESULT_MESSAGE: Record<DeliverResult, string> = {
  download: '파일을 내려받았어요.',
  share: '공유 시트로 보냈어요.',
  clipboard: '클립보드에 복사했어요. 원하는 곳에 붙여넣으세요.',
  manual: '',
}

/** "최종 정산하기" 결과를 CSV/텍스트 중 골라 내보내는 팝업. */
export function SettlementExportModal({ trip, result, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  async function run(kind: 'csv' | 'txt') {
    setBusy(true)
    setMessage(null)
    setFallbackText(null)

    const content = kind === 'csv' ? settlementToCsv(result, { trip }) : settlementToText(result, { trip })

    // 카톡용 텍스트는 파일이 아니라 텍스트 자체를 공유한다(인코딩 오독 방지,
    // 공유 시트에서 바로 메시지창에 붙는 흐름). CSV는 파일이어야 뜻이 있다.
    const deliverResult =
      kind === 'csv'
        ? await deliverFile(content, settlementFileName(trip, kind), 'text/csv;charset=utf-8')
        : await deliverText(content)
    setBusy(false)

    if (deliverResult === 'manual') {
      setMessage('파일로 못 내보냈어요. 아래 내용을 직접 복사해주세요.')
      setFallbackText(content)
      return
    }
    setMessage(RESULT_MESSAGE[deliverResult])
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="title">정산내용 내보내기</p>
        <p className="body">어떤 형식으로 받아볼까요?</p>

        <div className="row2">
          <button className="btn ghost" onClick={() => run('csv')} disabled={busy}>
            📊 엑셀(CSV)
          </button>
          <button className="btn ghost" onClick={() => run('txt')} disabled={busy}>
            📝 텍스트(카톡용)
          </button>
        </div>

        {message && <p className="note" style={{ marginTop: 9, color: 'var(--jade)' }}>{message}</p>}

        {fallbackText && (
          <textarea
            className="ta"
            readOnly
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
            style={{ marginTop: 9, minHeight: 160, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5 }}
          />
        )}

        <button className="btn quiet" style={{ marginTop: 12 }} onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
