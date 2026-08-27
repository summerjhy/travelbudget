import { useEffect, useState } from 'react'
import { disablePush, enablePush, pushEnabled, pushSupported, sendTestPush } from '../lib/push'

/**
 * 관리자 참여 알림 등록.
 *
 * 참여자가 여행에 새로 들어오면 이 기기로 알림이 온다. 관리자 비밀번호를
 * 받는 이유는 아무나 자기 폰을 등록해 남의 여행 참여를 엿보지 못하게
 * 하기 위해서다.
 *
 * 설정 탭 안쪽 접힌 섹션에 둔다 — 참여자 대부분에게는 쓸 일이 없다.
 */
export function PushPanel() {
  const supported = pushSupported()
  const [on, setOn] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    pushEnabled().then(setOn)
  }, [])

  async function handleEnable() {
    setBusy(true)
    setMsg(null)
    const r = await enablePush(pw)
    setBusy(false)
    if (r.ok) {
      setOn(true)
      setPw('')
      setMsg({ kind: 'ok', text: '이 기기로 알림을 보낼게요.' })
    } else {
      setMsg({ kind: 'err', text: r.error ?? '등록에 실패했어요.' })
    }
  }

  async function handleDisable() {
    setBusy(true)
    await disablePush()
    setBusy(false)
    setOn(false)
    setMsg({ kind: 'ok', text: '이 기기에서 알림을 껐어요.' })
  }

  async function handleTest() {
    setBusy(true)
    setMsg(null)
    const r = await sendTestPush(pw)
    setBusy(false)
    setMsg(
      r.ok
        ? { kind: 'ok', text: '보냈어요. 잠시 후 알림이 뜨는지 확인해주세요.' }
        : { kind: 'err', text: r.error },
    )
  }

  if (!supported) {
    return (
      <p className="note">
        이 브라우저는 알림을 지원하지 않아요. 안드로이드 크롬에서 홈 화면에 설치한 뒤 열어주세요.
      </p>
    )
  }

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>
        참여자가 여행에 새로 들어오면 이 기기로 알림이 와요. 관리자만 등록할 수 있어요.
      </p>

      {on ? (
        <>
          <p className="note" style={{ color: 'var(--jade)' }}>✅ 이 기기는 알림을 받고 있어요.</p>
          <div className="field">
            <label className="lab" htmlFor="pushPwTest">관리자 비밀번호 (시험 발송용)</label>
            <input
              id="pushPwTest"
              className="inp"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>
          <div className="editrow">
            <button className="btn quiet sm" style={{ flex: '0 0 40%' }} onClick={handleDisable} disabled={busy}>
              알림 끄기
            </button>
            <button className="btn sm" onClick={handleTest} disabled={busy || !pw}>
              {busy ? '보내는 중...' : '시험 알림 보내기'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="lab" htmlFor="pushPw">관리자 비밀번호</label>
            <input
              id="pushPw"
              className="inp"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pw) handleEnable() }}
            />
          </div>
          <button className="btn" onClick={handleEnable} disabled={busy || !pw}>
            {busy ? '등록 중...' : '이 기기로 알림 받기'}
          </button>
        </>
      )}

      {msg && (
        <p className={msg.kind === 'err' ? 'err' : 'note'} style={{ marginTop: 9 }}>
          {msg.text}
        </p>
      )}

      <p className="note" style={{ marginTop: 12 }}>
        홈 화면에 설치한 앱에서 등록해야 알림이 잘 도착해요. 브라우저 탭으로 열었을 때는
        알림이 오지 않을 수 있어요.
      </p>
    </>
  )
}
