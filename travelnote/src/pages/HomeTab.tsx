import { useNote } from '../context/NoteContext'
import { Bunny } from '../components/illustrations/Bunny'
import { Star, Heart, Cloud } from '../components/illustrations/Decor'
import { SecretTargetReveal } from '../components/SecretTargetReveal'
import { useSecretTarget } from '../lib/useSecretTarget'

/**
 * 홈: 매칭 전/후 상태를 안내한다.
 *
 * 매칭 후엔 내 비밀친구가 누구인지 알아야 실제로 관찰을 할 수 있으므로
 * (마니또 게임 자체가 "나만 알고 다른 사람은 모른다"는 구조 — 대상 본인과
 * 다른 참여자에게 비밀이어야 하는 거지, 관찰자 본인에게까지 숨기면 아무도
 * 관찰을 못 함) 이름을 보여주되, 옆 사람이 화면을 볼 수도 있으니 버튼을
 * 누르고 있는 동안만 나타나게 한다.
 */
export function HomeTab() {
  const { trip, personName, member } = useNote()
  const { displayName, loading: targetLoading } = useSecretTarget(trip?.id, member?.id)

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

          {!targetLoading && displayName && (
            <div style={{ margin: '12px 0 4px' }}>
              <SecretTargetReveal name={displayName} />
            </div>
          )}

          <p className="note" style={{ marginTop: 8 }}>
            생각날 때마다 <b>기록</b> 탭에서 짧게 메모를 남겨보세요.
            다른 사람에게는 끝까지 비밀이에요 — 옆에 누가 있을 땐 누르지 마세요.
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
