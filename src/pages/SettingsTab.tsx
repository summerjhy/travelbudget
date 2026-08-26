import { useTrip } from '../context/TripContext'

export function SettingsTab() {
  const { trip, personName, switchTrip } = useTrip()

  return (
    <section className="pad">
      <div className="sec first">공금 예산</div>
      <div className="box" />
      <div className="sec">여행 정보</div>
      <div className="box">
        <div className="tr"><span className="k">여행 이름</span><span className="v txt">{trip?.name}</span></div>
        <div className="tr"><span className="k">참여 코드</span><span className="v">{trip?.code}</span></div>
        <div className="tr"><span className="k">내 이름</span><span className="v txt">{personName}</span></div>
      </div>
      <div className="sec">참여자</div>
      <div className="box" />
      <div className="sec">다른 여행</div>
      <button className="btn quiet" onClick={switchTrip}>다른 여행 코드로 전환</button>
      <p className="note" style={{ marginTop: 9 }}>
        새 코드를 입력하면 그 여행으로 이동해요. 지금 코드를 다시 입력하면 이 여행으로 돌아올 수 있어요.
      </p>
    </section>
  )
}
