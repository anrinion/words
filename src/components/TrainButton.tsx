import type { CSSProperties } from 'react'
import { useTheme } from '../contexts/ThemeContext'

export function TrainButton({
  onClick,
  disabled,
  variant = 'primary',
  style,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  style?: CSSProperties
  children: React.ReactNode
}) {
  const { theme: t } = useTheme()
  const base: CSSProperties = {
    width: '100%', padding: 15, borderRadius: 14,
    fontSize: 15, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: t.fontBody,
    opacity: disabled ? 0.7 : 1,
  }
  const variantStyle: CSSProperties = variant === 'secondary'
    ? { background: t.surface, color: t.ink, border: `1px solid ${t.border}`, boxShadow: 'none' }
    : { background: t.pop, color: t.popInk, border: 'none', boxShadow: `0 2px 8px ${t.pop}46` }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variantStyle, ...style }}
    >
      {children}
    </button>
  )
}
