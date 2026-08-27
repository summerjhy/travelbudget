import { useAdmin } from '../context/AdminContext'

/** 관리자 인증 후 첫 화면. 할 수 있는 일 셋을 고른다. */
export function AdminMenu({
  onCreateTrip,
  onBrowse,
  onManage,
  onBack,
}: {
  onCreateTrip: () => void
  onBrowse: () => void
  onManage: () => void
  onBack: () => void
}) {
  const { signOut } = useAdmin()

  return (
    <div className="wrap">
      <header className="head">
        <div className="headrow">
          <h1 className="title">🛠 관리자</h1>
        </div>
        <div className="remain">
          <span><span>무엇을 할까요?</span></span>
        </div>
      </header>
      <div className="pad">
        <button className="btn" style={{ marginTop: 16 }} onClick={onCreateTrip}>➕ 새 여행 만들기</button>
        <p className="note" style={{ margin: '7px 0 14px' }}>
          코드·날짜·목적지·통화를 정해 새 가계부를 엽니다.
        </p>

        <button className="btn ghost" onClick={onBrowse}>🧭 여행 둘러보기</button>
        <p className="note" style={{ margin: '7px 0 14px' }}>
          코드를 몰라도 아무 여행이나 열어볼 수 있어요.
        </p>

        <button className="btn ghost" onClick={onManage}>🗂 여행 관리하기</button>
        <p className="note" style={{ margin: '7px 0 14px' }}>
          여행 정보를 고치거나 지웁니다.
        </p>

        <button
          className="btn quiet"
          style={{ marginTop: 6 }}
          onClick={() => { signOut(); onBack() }}
        >
          나가기
        </button>
      </div>
    </div>
  )
}
