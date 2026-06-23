import { useTheme } from '../contexts/ThemeContext'

export default function ModalShell({
  title,
  onClose,
  maxWidth = 400,
  children,
}: {
  title?: string
  onClose: () => void
  maxWidth?: number
  children: React.ReactNode
}) {
  const { theme: t } = useTheme()
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: t.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.surface, borderRadius: t.radius,
          width: '100%', maxWidth, padding: 20,
          boxShadow: '0 24px 60px -16px rgba(0,0,0,.5)',
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: t.fontHead, fontSize: 16, fontWeight: 600, color: t.ink }}>{title}</span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: t.inkFaint, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
            >×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
