export function validateName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: '이름을 입력해주세요.' }
  if (trimmed.length > 10) return { ok: false, error: '10자 이하로 입력해주세요.' }
  return { ok: true, name: trimmed }
}
