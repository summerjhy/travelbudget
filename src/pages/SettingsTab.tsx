import { useState } from 'react'
import { useTrip } from '../context/TripContext'
import { MAX_NAME_LENGTH, useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useBudgets } from '../lib/useBudgets'
import { currencyLabel } from '../lib/currencies'
import { foreignCurrencies } from '../lib/tripCurrency'
import { THEMES, applyTheme, getStoredTheme, setStoredTheme, type ThemeCode } from '../lib/themes'
import { useEntries } from '../lib/useEntries'
import { ExportPanel } from '../components/ExportPanel'
import { BudgetPanel } from '../components/BudgetPanel'
import { ShareTripButton } from '../components/ShareTripButton'
import { Collapsible } from '../components/Collapsible'
import { EmojiPicker } from '../components/EmojiPicker'
import { MemberName } from '../components/MemberName'
import { withEmoji } from '../lib/memberEmoji'
import { todayForTrip } from '../lib/tripDate'

export function SettingsTab() {
  const { trip, member, switchTrip, renameMe } = useTrip()
  const { members, allMembers, refresh: refreshMembers, addMember, setMemberEmoji, deactivateMember } = useTripMembers(trip?.id)
  const { rates, setManualRate, fetchNow } = useRates(trip?.id, trip?.code)
  const { budgets, total, addBudget, updateBudget, removeBudget } = useBudgets(trip?.id)
  const { entries } = useEntries(trip?.id)

  // 통화별 직접입력 칸. 통화 코드 → 입력 중인 값.
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})
  const [rateBusy, setRateBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [emojiDraft, setEmojiDraft] = useState('')
  const [memberError, setMemberError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeCode>(getStoredTheme)

  const sortedRateDates = Object.keys(rates).sort()
  const currencies = foreignCurrencies(trip)
  // 환율도 예산도 "지금" 기준이다. 여행 시작일이 아직 안 왔다고 그 날짜로 잡으면
  // 미래 날짜라 외부 API 가 값을 못 주고, 목록에도 오늘이 아닌 날짜가 떠서 헷갈린다.
  const defaultRateDate = todayForTrip(trip)

  function pickTheme(next: ThemeCode) {
    setTheme(next)
    applyTheme(next)
    setStoredTheme(next)
  }

  async function handleAddMember() {
    setMemberError(null)
    const result = await addMember(newMemberName)
    if (result.ok) setNewMemberName('')
    else setMemberError(result.error ?? '참여자 추가에 실패했어요.')
  }

  async function handleSaveMyName() {
    setMemberError(null)
    // 이모지는 trip_members 에만 있어 이름과 저장 경로가 다르다.
    // 이모지를 먼저 넣어야 이름 변경 후 refresh 결과에 함께 반영된다.
    if (member && emojiDraft !== member.emoji) {
      const e = await setMemberEmoji(member.id, emojiDraft)
      if (!e.ok) {
        setMemberError(e.error ?? '이모지 저장에 실패했어요.')
        return
      }
    }
    const result = await renameMe(nameDraft)
    if (!result.ok) {
      setMemberError(result.error ?? '이름 변경에 실패했어요.')
      return
    }
    setEditingName(false)
    // trip_members.person_id 가 바뀌었으므로 목록도 다시 읽는다.
    await refreshMembers()
  }

  async function handleDeactivate(memberId: string, name: string) {
    if (!confirm(`'${name}' 을(를) 참여자 목록에서 뺄까요?
이미 입력된 지출 기록은 그대로 남아요.`)) return
    setMemberError(null)
    const result = await deactivateMember(memberId)
    if (!result.ok) setMemberError(result.error ?? '삭제에 실패했어요.')
  }
  async function handleManualRate(currency: string) {
    const v = parseFloat(rateInputs[currency] ?? '')
    if (!v) return
    const result = await setManualRate(defaultRateDate, currency, v)
    if (result.ok) {
      setRateInputs((prev) => ({ ...prev, [currency]: '' }))
    } else {
      setError(result.error ?? '환율 저장에 실패했어요.')
    }
  }

  /** 여행에 설정된 외화를 한 번에 조회한다 (Edge Function 이 통화 목록을 보고 전부 돌려준다). */
  async function handleFetchNow() {
    setRateBusy(true)
    setError(null)
    const result = await fetchNow(defaultRateDate)
    setRateBusy(false)
    if (!result.ok) {
      setError(result.error ?? '환율을 못 가져왔어요. 직접 입력해주세요.')
      return
    }
    const missing = currencies.filter((c) => result.rates?.[c] === undefined)
    if (missing.length > 0) {
      setError(`${missing.join(', ')} 환율은 못 가져왔어요. 아래에 직접 입력해주세요.`)
    }
  }

  return (
    <section className="pad">
      {/* ───────── 여행 설정값 확인 ───────── */}
      <div className="gbox">
      <div className="group first">🧭 여행 설정값 확인</div>
      <div className="sec">✈️ 여행 정보</div>
      <div className="box">
        <div className="tr"><span className="k">여행 이름</span><span className="v txt">{trip?.name}</span></div>
        <div className="tr"><span className="k">참여 코드</span><span className="v">{trip?.code}</span></div>
        <div className="tr"><span className="k">목적지</span><span className="v txt">{trip?.destinations?.length ? trip.destinations.join(' · ') : '미지정'}</span></div>
        <div className="tr"><span className="k">사용 통화</span><span className="v txt">{trip?.spend_currencies?.join(' · ') || '-'}</span></div>
      </div>

      <div className="sec">🙋 참여자</div>
      <div className="box" style={{ marginBottom: 10 }}>
        {members.map((m) => {
          const isMe = m.id === member?.id
          if (isMe && editingName) {
            return (
              <div key={m.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <EmojiPicker value={emojiDraft} onChange={setEmojiDraft} label="나를 표현하는 이모지" />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="inp"
                    autoFocus
                    maxLength={MAX_NAME_LENGTH}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMyName() }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn sm" style={{ width: 58 }} onClick={handleSaveMyName}>저장</button>
                  <button className="x" onClick={() => setEditingName(false)}>취소</button>
                </div>
                {nameDraft.trim() && (
                  <p className="note" style={{ marginTop: 7 }}>
                    이렇게 보여요 — <b>{withEmoji(emojiDraft, nameDraft.trim())}</b>
                  </p>
                )}
              </div>
            )
          }
          return (
            <div className="tr" key={m.id}>
              <span className="k">
                <MemberName emoji={m.emoji} name={m.personName} />
                {isMe && <span style={{ color: 'var(--jade)' }}> · 나</span>}
              </span>
              <span className="v txt">
                {isMe ? (
                  <button className="act mine" onClick={() => { setNameDraft(m.personName); setEmojiDraft(m.emoji); setEditingName(true); setMemberError(null) }}>내 이름 바꾸기</button>
                ) : (
                  <button className="act warn" onClick={() => handleDeactivate(m.id, m.displayName)}>빼기</button>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <div className="row2">
        <input
          className="inp"
          placeholder="참여자 이름 추가"
          maxLength={MAX_NAME_LENGTH}
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember() }}
        />
        <button className="btn ghost" style={{ flex: '0 0 80px' }} onClick={handleAddMember}>추가</button>
      </div>
      {memberError && <p className="err">{memberError}</p>}
      <p className="note" style={{ marginTop: 9 }}>
        이름은 본인의 것만 수정 가능해요. 접속할 때 매번 같은 이름을 입력해야
        데이터의 정확도가 높아져요.
      </p>

      <div className="sec">💰 공금 예산</div>
      {trip && (
        <BudgetPanel
          trip={trip}
          budgets={budgets}
          total={total}
          rates={rates}
          addBudget={addBudget}
          updateBudget={updateBudget}
          removeBudget={removeBudget}
          today={defaultRateDate}
        />
      )}

      {currencies.length > 0 && (
        <>
        <div className="sec">💱 환율 · 원화 기준</div>
        <p className="note" style={{ marginBottom: 10 }}>
          이 여행에 설정된 통화를 한 번에 조회해서 날짜별로 저장해둬요. 직접 적으면 그 값이 우선이에요.
          내역에서 외화·원화를 둘 다 입력하면 그 건은 실제 청구 환율로 잡혀요.
        </p>
        <div className="box" style={{ marginBottom: 10 }}>
          <div className="tr" style={{ background: 'rgba(42,107,92,.06)' }}>
            <span className="k" style={{ fontWeight: 600, color: 'var(--ink)' }}>날짜</span>
            <span className="v" style={{ fontWeight: 600 }}>
              {currencies.map((c) => `1${c}`).join(' · ')}
            </span>
          </div>
          {sortedRateDates.length ? (
            sortedRateDates.map((d) => (
              <div className="tr" key={d}>
                <span className="k">{d}</span>
                <span className="v">
                  {currencies
                    .map((c) => (rates[d]?.[c] !== undefined ? `₩${rates[d][c].toFixed(2)}` : '—'))
                    .join(' · ')}
                </span>
              </div>
            ))
          ) : (
            <div className="tr"><span className="k">저장된 환율</span><span className="v txt">없음</span></div>
          )}
        </div>

        <button className="btn ghost" onClick={handleFetchNow} disabled={rateBusy}>
          {rateBusy ? '조회 중...' : `오늘(${defaultRateDate}) 환율 일괄 조회`}
        </button>

        <div className="sec">✍️ 환율 직접 입력</div>
        {currencies.map((c) => (
          <div className="row2" style={{ marginBottom: 7 }} key={c}>
            <span className="k" style={{ flex: '0 0 42%', alignSelf: 'center', fontSize: 13 }}>
              1 {currencyLabel(c)}
            </span>
            <input
              className="inp num"
              inputMode="decimal"
              aria-label={`${c} 환율 직접 입력`}
              placeholder={rates[defaultRateDate]?.[c] !== undefined ? String(rates[defaultRateDate][c].toFixed(2)) : '원'}
              value={rateInputs[c] ?? ''}
              onChange={(e) => setRateInputs((prev) => ({ ...prev, [c]: e.target.value }))}
              onBlur={() => handleManualRate(c)}
            />
          </div>
        ))}
        <p className="note" style={{ marginTop: 7 }}>
          입력·조회 모두 오늘({defaultRateDate}) 날짜로 저장돼요. 다른 날짜 환율은 그 날 조회하면 따로 쌓여요.
        </p>
        </>
      )}

      {error && <p className="err">{error}</p>}

      <div className="sec">📤 내역 내보내기</div>
      {trip && (
        <div className="box" style={{ padding: 14, marginBottom: 10 }}>
          <ExportPanel trip={trip} members={allMembers} entries={entries} />
        </div>
      )}

      <div className="sec">🔄 다른 여행</div>
      <button className="btn quiet" onClick={switchTrip}>다른 여행으로 이동하기</button>
      <p className="note" style={{ marginTop: 9 }}>
        이 버튼을 클릭하면 초기 화면으로 돌아가서 다른 여행에 참여할 수 있어요.
        다른 여행의 코드를 알고 있어야 참여할 수 있고, 지금 이 여행의 코드(<b>{trip?.code}</b>)를
        다시 입력하면 이 여행으로 돌아올 수 있어요.
      </p>


      {/* ───────── 사용 꿀팁 (기본 접힘) ───────── */}
      </div>

      <div className="gbox">
      <div className="group">💡 여행 가계부 사용 꿀팁</div>

      <Collapsible title="🎨 어플 테마 색상 변경">
          <div className="box" style={{ padding: 14, marginBottom: 10 }}>
            <div className="dots" role="group" aria-label="화면 색상 고르기">
              {THEMES.map((t) => (
                <button
                  key={t.code}
                  className="dot"
                  aria-pressed={theme === t.code}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => pickTheme(t.code)}
                >
                  <i style={{ background: t.swatch }} />
                </button>
              ))}
            </div>
            <p className="note" style={{ marginTop: 9 }}>
              기분따라 바꿔 쓰세요. 이 기기에서만 바뀌고 다른 사람 화면은 그대로예요.
            </p>
          </div>
      </Collapsible>

      <Collapsible title="📱 for 삼성폰 (Android)">
        <Collapsible title="📱 여행가계부 어플 삼성폰 홈 화면에 추가하기">
            <ol className="steps">
              <li>카톡에서 링크를 연 뒤 <b>다른 브라우저로 열기 → Chrome</b></li>
              <li>오른쪽 위 <b>⋮</b> 탭</li>
              <li><b>설치 및 바로가기 만들기</b> 선택</li>
              <li>앱 설치가 완료되면 홈 화면에 추가하기</li>
            </ol>
            <p className="note" style={{ marginTop: 9 }}>
              홈 화면에 설치하면 앱처럼 아이콘으로 바로 열 수 있어요.
            </p>
        </Collapsible>
        <Collapsible title="📸 갤럭시에서 캡쳐로 바로 기록하기">
            <p className="note" style={{ margin: 0 }}>
              카드 결제 캡쳐를 찍고 공유 버튼을 누르면 공유 대상 목록에 이 앱이 떠요.
              앱을 고르면 캡쳐 → 공유만으로 자동 분석까지 끝나요.
            </p>
            <p className="note" style={{ margin: '9px 0 0' }}>
              목록에 여행가계부 앱이 보이지 않는 경우, <b>더보기</b>를 눌러 애플리케이션 중
              여행가계부 앱을 추가한 뒤 다시 시도해주세요.
            </p>
        </Collapsible>
      </Collapsible>

      <Collapsible title="📱 for 아이폰 (iOS)">
        <Collapsible title="📱 여행가계부 어플 아이폰 홈 화면에 추가하기">
            <ol className="steps">
              <li>카톡에서 링크를 연 뒤 오른쪽 아래 <b>⋯ → Safari로 열기</b></li>
              <li>아래 가운데 <b>공유 버튼(↑)</b> 탭</li>
              <li><b>홈 화면에 추가</b> 선택</li>
              <li>이름 바꾸고 <b>추가</b></li>
            </ol>
        </Collapsible>
        <Collapsible title="📸 아이폰에서 캡쳐로 기록하기">
            <p className="note" style={{ margin: 0 }}>
              iOS는 앱 간 공유 시트에 홈 화면 앱을 등록하는 기능을 지원하지 않아요.
              기록 탭의 <b>📸 사진으로</b> 를 눌러 캡쳐를 직접 선택해주세요.
            </p>
        </Collapsible>
      </Collapsible>
      </div>

      <div className="gbox">
      <div className="sec">📮 함께 쓰기</div>
      {trip && <ShareTripButton trip={trip} />}
      </div>
      <div style={{ height: 30 }} />
    </section>
  )
}
