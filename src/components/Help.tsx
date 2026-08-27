import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 라벨 옆에 붙이는 동그란 물음표.
 *
 * 마우스오버로도 열리고(CSS), 터치 기기에서는 hover 가 없으므로
 * 눌러서도 열린다. 바깥을 누르거나 Esc 로 닫는다.
 */
export function Help({ children, label = '설명 보기' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <button
      ref={ref}
      type="button"
      className="help"
      aria-label={label}
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation()
        setOpen((v) => !v)
      }}
    >
      ?
      <span className="bubble" role="tooltip">{children}</span>
    </button>
  )
}
