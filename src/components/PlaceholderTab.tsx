export default function PlaceholderTab({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      color: 'var(--ink-4)',
    }}>
      <span style={{ fontSize: 32 }}>○</span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12 }}>Coming soon</span>
    </div>
  )
}
