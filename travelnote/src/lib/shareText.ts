/**
 * 텍스트를 공유 시트로 넘긴다. 파일 없이 navigator.share({text})만 시도한다 —
 * .txt 파일로 공유하면 카톡 등이 인코딩을 잘못 짐작해 내용이 깨지는 문제가
 * travelbudget에서 있었다(CLAUDE.md 15단계 참고). 텍스트 자체만 공유하면
 * 그 문제가 없다.
 */
export async function shareText(text: string): Promise<{ ok: boolean; method: 'share' | 'clipboard' | 'none' }> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return { ok: true, method: 'share' }
    } catch {
      // 사용자가 공유를 취소했거나 실패 — 클립보드로 폴백한다.
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true, method: 'clipboard' }
  } catch {
    return { ok: false, method: 'none' }
  }
}
