import { useMemo, useState } from 'react'
import { useTrip } from '../context/TripContext'
import { detectPlatform, isStandalone, useInstallPrompt } from '../lib/install'

/**
 * 처음 들어온 사람이 자리를 잡기까지의 흐름.
 *
 * 코드 → 이름 다음에 딱 한 번 끼어든다. 예전에는 이름을 넣자마자 빈 입력창으로
 * 떨어져서, 홈 화면 설치 안내는 설정 탭 맨 아래에 접혀 있어 볼 일이 없었고
 * 입력 규칙도 작은 주석으로만 있었다. 둘 다 여기서 처음에 보여준다.
 *
 * 이미 홈 화면 앱으로 열었으면 설치 단계는 통째로 건너뛴다.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { trip, personName } = useTrip()
  const { canPrompt, promptInstall } = useInstallPrompt()

  // 마운트 시점에 한 번만 판단한다. 중간에 바뀌면 단계 수가 흔들려서 혼란스럽다.
  const showInstall = useMemo(() => !isStandalone(), [])
  const platform = useMemo(() => detectPlatform(), [])

  const [step, setStep] = useState(0)
  const [installMsg, setInstallMsg] = useState<string | null>(null)

  const steps = showInstall ? ['install', 'howto1', 'howto2', 'howto3'] : ['howto1', 'howto2', 'howto3']
  const current = steps[step]
  const last = step === steps.length - 1

  function next() {
    if (last) onDone()
    else setStep((s) => s + 1)
  }

  async function handleInstall() {
    const result = await promptInstall()
    if (result === 'accepted') {
      setInstallMsg('설치했어요! 이제 홈 화면 아이콘으로 바로 열 수 있어요.')
    } else if (result === 'dismissed') {
      setInstallMsg('나중에 설정 탭에서도 설치할 수 있어요.')
    } else {
      setInstallMsg('이 브라우저에서는 아래 방법으로 직접 추가해주세요.')
    }
  }

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">{trip?.name}</div>
        <h1 className="title">
          {current === 'install' ? '앱으로 설치하기' : `${personName}님, 이렇게 쓰면 돼요`}
        </h1>
      </header>

      <div className="pad">
        <div className="onb-dots" aria-label={`${steps.length}단계 중 ${step + 1}단계`}>
          {steps.map((s, i) => (
            <i key={s} className={i === step ? 'on' : ''} />
          ))}
        </div>

        {current === 'install' && (
          <div className="gbox">
            <div className="sec first">📱 홈 화면에 두면 훨씬 편해요</div>
            <p className="note" style={{ marginBottom: 12 }}>
              지금은 브라우저로 보고 있어요. 홈 화면에 설치하면 다음부터는
              카톡에서 링크를 다시 찾지 않고 아이콘만 눌러 바로 들어올 수 있어요.
            </p>

            {canPrompt && (
              <>
                <button className="btn" onClick={handleInstall}>홈 화면에 추가하기</button>
                <p className="note" style={{ margin: '9px 0 0' }}>
                  누르면 설치 창이 떠요.
                </p>
              </>
            )}

            {!canPrompt && platform === 'ios' && (
              <ol className="steps">
                <li>카톡에서 열었다면 오른쪽 아래 <b>⋯ → Safari로 열기</b></li>
                <li>아래 가운데 <b>공유 버튼(↑)</b> 탭</li>
                <li><b>홈 화면에 추가</b> 선택</li>
                <li>이름 확인하고 <b>추가</b></li>
              </ol>
            )}

            {!canPrompt && platform !== 'ios' && (
              <ol className="steps">
                <li>카톡에서 열었다면 <b>다른 브라우저로 열기 → Chrome</b></li>
                <li>오른쪽 위 <b>⋮</b> 탭</li>
                <li><b>설치</b> 또는 <b>앱 설치</b> 선택</li>
              </ol>
            )}

            {installMsg && <p className="note" style={{ marginTop: 9 }}>{installMsg}</p>}
          </div>
        )}

        {current === 'howto1' && (
          <div className="gbox">
            <div className="sec first">✍️ 쓴 만큼 한 줄씩</div>
            <div className="box" style={{ padding: 14, marginBottom: 10 }}>
              <div className="onb-eg">야시장 380</div>
              <div className="onb-eg">택시 45 {personName}</div>
              <div className="onb-eg">숙소 50000원</div>
            </div>
            <p className="note">
              <b>단위를 안 적으면</b> 입력창 위에서 고른 통화로 읽어요.
              <b>원</b>이나 <b>엔</b>처럼 단위를 적으면 그 돈으로 들어가요.
            </p>
            <p className="note" style={{ marginTop: 9 }}>
              이름을 적으면 그 사람이 <b>개인으로 쓴 돈</b>, 안 적으면 <b>공금</b>이에요.
            </p>
          </div>
        )}

        {current === 'howto2' && (
          <div className="gbox">
            <div className="sec first">📸 캡쳐로도 돼요</div>
            <p className="note">
              카드 결제 알림을 캡쳐해서 <b>📸 사진으로</b> 버튼으로 올리면
              가게 이름과 금액을 알아서 읽어요. 한 번에 여러 장도 돼요.
            </p>
            <p className="note" style={{ marginTop: 9 }}>
              {platform === 'ios' ? (
                <>아이폰은 기록 탭의 <b>📸 사진으로</b> 를 눌러 캡쳐를 고르면 돼요.</>
              ) : (
                <>갤럭시는 캡쳐 후 <b>공유</b>를 누르고 목록에서 이 앱을 고르면 바로 분석까지 끝나요.</>
              )}
            </p>
            <p className="note" style={{ marginTop: 9 }}>
              읽은 내용은 저장 전에 확인하고 고칠 수 있어요.
            </p>
          </div>
        )}

        {current === 'howto3' && (
          <div className="gbox">
            <div className="sec first">💰 남은 돈은 맨 위에</div>
            <p className="note">
              화면 맨 위에 <b>공금이 얼마 남았는지</b> 항상 떠 있어요.
              누가 얼마 썼는지는 <b>내역</b> 탭에서 볼 수 있고요.
            </p>
            <p className="note" style={{ marginTop: 9 }}>
              잘못 적었으면 내역에서 그 항목을 눌러 고치거나 지우면 돼요.
            </p>
            <p className="note" style={{ marginTop: 9 }}>
              이 안내는 <b>설정 탭 → 사용법 다시 보기</b>에서 언제든 다시 볼 수 있어요.
            </p>
          </div>
        )}

        <button className="btn" style={{ marginTop: 12 }} onClick={next}>
          {last ? '시작하기' : '다음'}
        </button>
        {!last && (
          <button className="btn quiet" style={{ marginTop: 9 }} onClick={onDone}>
            건너뛰기
          </button>
        )}
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
