/** 관리자가 코드별 안내를 따로 정하지 않았을 때 홈에 보여줄 기본 단계. */
export const DEFAULT_GUIDE_STEPS = [
  '비밀친구의 행동을 관찰해요',
  '생각날 때마다 짧게 메모해요',
  '마지막 날, 비밀친구에게 발송해요',
]

export const MAX_GUIDE_STEPS = 5
export const MAX_GUIDE_STEP_LENGTH = 60

export function guideStepsOf(steps: string[] | null | undefined) {
  return steps && steps.length > 0 ? steps : DEFAULT_GUIDE_STEPS
}
