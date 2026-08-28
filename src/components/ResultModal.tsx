/**
 * 사진 분석 결과처럼, 시간이 걸린 뒤 나오는 결과를 화면 아래 텍스트로
 * 조용히 띄우면 한눈판 사이에 놓치기 쉽다. 확인 버튼을 누르기 전까지
 * 화면 가운데 붙잡아 둔다 — 타이머로 사라지지 않으므로 앱을 최소화했다가
 * 돌아와도 그대로 남아 있다.
 */
export function ResultModal({
  title,
  body,
  onClose,
}: {
  title: string
  body: string
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="title">{title}</p>
        <p className="body">{body}</p>
        <button className="btn" onClick={onClose}>확인</button>
      </div>
    </div>
  )
}
