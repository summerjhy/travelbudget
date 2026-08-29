import { useNote } from '../context/NoteContext'
import { Bunny } from '../components/illustrations/Bunny'
import { Star, Heart, Cloud } from '../components/illustrations/Decor'

/**
 * 홈: 매칭 전/후 상태만 안내한다. 관찰 대상 이름은 여기서도 절대 보여주지
 * 않는다 — 관찰일지 컨셉의 핵심이 "누구인지 몰래" 이다.
 */
export function HomeTab() {
  const { trip, personName } = useNote()

  if (!trip) return null

  const matched = !!trip.matched_at

  return (
    <section className="pad">
      <div className="sec first">👋 안녕하세요, {personName}님</div>

      {matched ? (
        <div className="secret-card">
          <Cloud size={44} className="decor" style={{ left: -6, top: -6 }} />
          <Cloud size={36} className="decor" style={{ right: -8, bottom: 6 }} />
          <Star size={16} className="decor" style={{ right: 14, top: 10 }} />
          <div className="illust">
            <Bunny size={92} pose="peek" />
          </div>
          <p className="msg">비밀친구를 관찰중이에요</p>
          <p className="note" style={{ marginTop: 8 }}>
            생각날 때마다 <b>기록</b> 탭에서 짧게 메모를 남겨보세요.
            누구인지는 마지막 날까지 비밀이에요.
          </p>
        </div>
      ) : (
        <div className="secret-card">
          <Star size={18} className="decor" style={{ left: 10, top: 12 }} />
          <Heart size={16} className="decor" style={{ right: 16, top: 16 }} />
          <div className="illust">
            <Bunny size={92} pose="wave" />
          </div>
          <p className="msg">아직 제비뽑기 전이에요</p>
          <p className="note" style={{ marginTop: 8 }}>
            관리자가 제비뽑기를 하면 나만의 비밀친구가 정해져요. 조금만 기다려주세요.
          </p>
        </div>
      )}

      <div className="sec">📝 어떻게 쓰나요?</div>
      <ul className="box steps">
        <li><span className="stepnum">1</span>비밀친구의 행동을 관찰해요</li>
        <li><span className="stepnum">2</span>생각날 때마다 짧게 메모해요</li>
        <li><span className="stepnum">3</span>마지막 날, 비밀친구에게 발송해요</li>
      </ul>
      <div style={{ height: 20 }} />
    </section>
  )
}
