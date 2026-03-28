import { useEffect, useRef, useState, useCallback } from 'react'
import { scaleOrdinal } from 'd3-scale'
import CirclePacking from './CirclePacking'
import type { TopicsData } from './CirclePacking'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

const PALETTE = [
  '#4e9af1','#f0a653','#5ec98b','#e06c75','#c792ea',
  '#56b6c2','#e5c07b','#98c379','#f07178','#7986cb',
  '#4db6ac','#ff8a65',
]
const colorScale = scaleOrdinal<string>().range(PALETTE)

export default function TopicsTab() {
  const [data,          setData]          = useState<TopicsData | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [mode,          setMode]          = useState<'recent' | 'full'>('recent')
  const [activeCluster, setActiveCluster] = useState<number | null>(null)

  // Width-only measurement — height comes from flex layout
  const vizRef  = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    setData(null); setError(null); setActiveCluster(null)
    fetch(`${BASE}/data/topics_${mode}.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<TopicsData> })
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [mode])

  // Measure viz container width only — height is handled by flex
  useEffect(() => {
    const el = vizRef.current
    if (!el) return
    let t: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(([entry]) => {
      clearTimeout(t)
      t = setTimeout(() => setWidth(Math.floor(entry.contentRect.width)), 60)
    })
    ro.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => { clearTimeout(t); ro.disconnect() }
  }, [])

  const toggle = useCallback((id: number) =>
    setActiveCluster(p => p === id ? null : id), [])

  const updatedAt = data?.updated_at
    ? new Date(data.updated_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    // Outer panel: fills the main area entirely
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '20px 28px 0',
      fontFamily: 'var(--font-ui)',
    }}>

      {/* ── Top chrome: title + mode toggle + stats ── */}
      <div style={{ flexShrink: 0, paddingBottom: 14, borderBottom: '1px solid var(--ink-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>
              News Topics
            </h2>
            {updatedAt && (
              <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {updatedAt}
              </p>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{
            display: 'flex', border: '1px solid var(--ink-5)',
            borderRadius: 'var(--radius-sm)', padding: 2, gap: 2,
          }}>
            {(['recent', 'full'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '3px 14px', borderRadius: 4, border: 'none',
                fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
                transition: 'all .12s',
                background: mode === m ? 'var(--ink)' : 'transparent',
                color:      mode === m ? 'var(--white)' : 'var(--ink-3)',
              }}>
                {m === 'recent' ? 'Recent' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        {data && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'clusters', value: data.children.length },
              { label: 'articles', value: data.children.reduce((s, c) => s + c.count, 0) },
              { label: 'largest',  value: Math.max(...data.children.map(c => c.count)), suffix: ' art.' },
            ].map(({ label, value, suffix }) => (
              <div key={label} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ink-6)', background: 'var(--ink-7)',
              }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                  {value.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 5 }}>
                  {suffix ?? ''}{label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Viz: flex:1 fills all remaining height ── */}
      <div ref={vizRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0,
      }}>
        {error ? (
          <Centered>
            <span style={{ color: '#ef4444', fontSize: 13 }}>Could not load data — {error}</span>
          </Centered>
        ) : !data || !width ? (
          <Centered>
            <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Loading…</span>
          </Centered>
        ) : data.children.length === 0 ? (
          <Centered>
            <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>No clusters found.</span>
          </Centered>
        ) : (
          <AutoHeightPacking
            data={data} width={width}
            activeCluster={activeCluster} onClusterClick={toggle}
          />
        )}
      </div>

      {/* ── Legend: fixed-height strip at the bottom ── */}
      {data && data.children.length > 0 && (
        <div style={{
          flexShrink: 0, padding: '10px 0 14px',
          borderTop: '1px solid var(--ink-6)',
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        }}>
          {data.children.map(c => {
            const color = colorScale(String(c.cluster_id))
            const active = activeCluster === null || activeCluster === c.cluster_id
            return (
              <button key={c.cluster_id} onClick={() => toggle(c.cluster_id)} title={c.name}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20,
                  border: `1px solid ${active ? color : 'var(--ink-5)'}`,
                  background: active ? `${color}15` : 'transparent',
                  color: active ? color : 'var(--ink-4)',
                  fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
                  transition: 'all .12s', cursor: 'pointer',
                }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: color, opacity: active ? 1 : 0.3, display: 'inline-block',
                }} />
                <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
                <span style={{ opacity: 0.45, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {c.count}
                </span>
              </button>
            )
          })}
          {activeCluster !== null && (
            <button onClick={() => setActiveCluster(null)} style={{
              padding: '3px 10px', borderRadius: 20,
              border: '1px solid var(--ink-5)', background: 'transparent',
              color: 'var(--ink-4)', fontSize: 12, fontFamily: 'var(--font-ui)',
              cursor: 'pointer', transition: 'all .12s',
            }}>
              Clear ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Measures its own height via ResizeObserver, then passes exact px to CirclePacking
function AutoHeightPacking({ data, width, activeCluster, onClusterClick }: {
  data: TopicsData; width: number
  activeCluster: number | null; onClusterClick: (id: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setHeight(Math.floor(entry.contentRect.height)))
    ro.observe(el)
    setHeight(Math.floor(el.getBoundingClientRect().height))
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {height && (
        <CirclePacking
          data={data} width={width} height={height}
          activeCluster={activeCluster} onClusterClick={onClusterClick}
        />
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</div>
  )
}
