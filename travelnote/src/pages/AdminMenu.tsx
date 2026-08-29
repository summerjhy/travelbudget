import { useAdmin } from '../context/AdminContext'

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
        <p className="subtitle">무엇을 할까요?</p>
      </header>
      <div className="pad">
        <button className="btn" style={{ marginTop: 16 }} onClick={onCreateTrip}>➕ 새 관찰일지 만들기</button>
        <p className="note" style={{ margin: '7px 0 14px' }}>
          코드·참여자 이름을 정해 새 관찰일지를 엽니다.
        </p>

        <button className="btn ghost" onClick={onBrowse}>🧭 관찰일지 둘러보기</button>
        <p className="note" style={{ margin: '7px 0 14px' }}>
          코드를 몰라도 아무 여행이나 열어볼 수 있어요.
        </p>

        <button className="btn ghost" onClick={onManage}>🗂 관찰일지 관리하기</button>
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
