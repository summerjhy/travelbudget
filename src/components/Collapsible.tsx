import { useState, type ReactNode } from 'react'

/**
 * 눌러서 펼치는 섹션.
 *
 * 설정 탭이 길어져서 자주 안 보는 것들을 접어둔다.
 * `.sec` 과 같은 자리에 놓이므로 생김새도 그에 맞춘다.
 */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapse">
      <button
        type="button"
        className="collapse-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="collapse-mark" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  )
}
