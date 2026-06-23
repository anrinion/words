import { useTheme } from '../contexts/ThemeContext'

export default function PhaseShell({
  title,
  subtitle,
  badge,
  topPadding = 18,
  children,
}: {
  title?: string
  subtitle?: string
  badge?: string
  topPadding?: number
  children: React.ReactNode
}) {
  const { theme: t } = useTheme()
  return (
    <div style={{ padding: `${topPadding}px 22px 80px`, maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {title && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ fontSize: 23, fontWeight: 700, color: t.ink, margin: 0, fontFamily: t.fontHead }}>
              {title}
            </h2>
            {badge && (
              <span style={{ fontSize: 13.5, fontWeight: 500, color: t.inkSoft, fontFamily: t.fontBody }}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p style={{ fontSize: 14.5, color: t.inkSoft, margin: '6px 0 0', fontFamily: t.fontBody }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
