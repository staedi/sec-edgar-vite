import { useEffect, useRef, useState, useCallback } from 'react'
import { scaleOrdinal } from 'd3-scale'
import CirclePacking from './CirclePacking'
import type { TopicsData, MetaCategoryNode, ClusterNode } from './CirclePacking'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

const PALETTE = [
  '#4e9af1', '#f0a653', '#5ec98b', '#e06c75', '#c792ea',
  '#56b6c2', '#e5c07b', '#98c379', '#f07178', '#7986cb',
  '#4db6ac', '#ff8a65',
]
const META_PALETTE = [
  '#7c8cf8', '#f59e6b', '#34d399', '#f87171', '#a78bfa',
  '#22d3ee', '#fbbf24', '#4ade80',
]
// Remove these:
// import { scaleOrdinal } from 'd3-scale'
// const colorScale     = scaleOrdinal<string>().range(PALETTE)
// const metaColorScale = scaleOrdinal<string>().range(META_PALETTE)

// Add these instead:
function clusterColor(cluster_id: number): string {
  return PALETTE[cluster_id % PALETTE.length]
}
function metaClusterColor(metaName: string): string {
  let hash = 0
  for (let i = 0; i < metaName.length; i++) hash = (hash * 31 + metaName.charCodeAt(i)) >>> 0
  return META_PALETTE[hash % META_PALETTE.length]
}

function allClusters(data: TopicsData): ClusterNode[] {
  return data.children.flatMap((m: MetaCategoryNode) => m.children)
}

export default function TopicsTab() {
  const [data, setData] = useState<TopicsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'recent' | 'full'>('recent')
  const [activeCluster, setActiveCluster] = useState<number | null>(null)
  const [activeMeta, setActiveMeta] = useState<string | null>(null)

  const vizRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    setData(null); setError(null); setActiveCluster(null); setActiveMeta(null)
    fetch(`${BASE}/data/topics_${mode}.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<TopicsData> })
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [mode])

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

  const toggleCluster = useCallback((id: number) =>
    setActiveCluster(p => p === id ? null : id), [])

  const toggleMeta = useCallback((name: string) => {
    setActiveMeta(p => p === name ? null : name)
    setActiveCluster(null) // clear cluster selection when switching meta
  }, [])

  const clearAll = useCallback(() => {
    setActiveCluster(null); setActiveMeta(null)
  }, [])

  const updatedAt = data?.updated_at
    ? new Date(data.updated_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : null

  const hasActive = activeCluster !== null || activeMeta !== null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '20px 28px 0',
      fontFamily: 'var(--font-ui)',
    }}>

      {/* ── Top chrome ── */}
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
                color: mode === m ? 'var(--white)' : 'var(--ink-3)',
              }}>
                {m === 'recent' ? 'Recent' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'topics', value: data.children.length },
              { label: 'clusters', value: allClusters(data).length },
              { label: 'articles', value: allClusters(data).reduce((s, c) => s + c.count, 0) },
              { label: 'largest', value: Math.max(...allClusters(data).map(c => c.count)), suffix: ' art.' },
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

      {/* ── Viz ── */}
      <div ref={vizRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {error ? (
          <Centered><span style={{ color: '#ef4444', fontSize: 13 }}>Could not load data — {error}</span></Centered>
        ) : !data || !width ? (
          <Centered><span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Loading…</span></Centered>
        ) : data.children.length === 0 ? (
          <Centered><span style={{ color: 'var(--ink-4)', fontSize: 13 }}>No clusters found.</span></Centered>
        ) : (
          <AutoHeightPacking
            data={data} width={width}
            activeCluster={activeCluster} onClusterClick={toggleCluster}
            activeMeta={activeMeta} onMetaClick={toggleMeta}
          />
        )}
      </div>

      {/* ── Legend: meta-category pills, cluster pills expand on click ── */}
      {data && data.children.length > 0 && (
        <div style={{
          flexShrink: 0, padding: '8px 0 12px',
          borderTop: '1px solid var(--ink-6)',
        }}>
          {/* Meta-category pills row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {data.children.map((meta: MetaCategoryNode) => {
              // const metaColor = metaColorScale(meta.name)
              const metaColor = metaClusterColor(meta.name)
              const metaActive = activeMeta === null || activeMeta === meta.name
              const expanded = activeMeta === meta.name
              return (
                <button key={meta.name} onClick={() => toggleMeta(meta.name)}
                  title={`${meta.count} articles · click to ${expanded ? 'collapse' : 'expand clusters'}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 11px', borderRadius: 20,
                    border: `1px solid ${metaActive ? metaColor : 'var(--ink-5)'}`,
                    background: expanded ? `${metaColor}22` : metaActive ? `${metaColor}10` : 'transparent',
                    color: metaActive ? metaColor : 'var(--ink-4)',
                    fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
                    letterSpacing: '0.03em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'all .12s',
                    opacity: (activeMeta !== null && !metaActive) ? 0.4 : 1,
                  }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 2, flexShrink: 0,
                    background: metaColor, opacity: metaActive ? 1 : 0.3,
                    display: 'inline-block',
                  }} />
                  {meta.name}
                  <span style={{ opacity: 0.5, fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: 10 }}>
                    {meta.count}
                  </span>
                  <span style={{ opacity: 0.4, fontSize: 9, marginLeft: 1 }}>
                    {expanded ? '▲' : '▼'}
                  </span>
                </button>
              )
            })}
            {hasActive && (
              <button onClick={clearAll} style={{
                padding: '3px 10px', borderRadius: 20,
                border: '1px solid var(--ink-5)', background: 'transparent',
                color: 'var(--ink-4)', fontSize: 11, fontFamily: 'var(--font-ui)',
                cursor: 'pointer', transition: 'all .12s',
              }}>Clear ×</button>
            )}
          </div>

          {/* Cluster pills — only shown for the expanded meta-category */}
          {activeMeta !== null && (() => {
            const meta = data.children.find((m: MetaCategoryNode) => m.name === activeMeta)
            if (!meta) return null
            // const metaColor = metaColorScale(meta.name)
            const metaColor = metaClusterColor(meta.name)
            return (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 5,
                marginTop: 6, paddingTop: 6,
                borderTop: `1px solid ${metaColor}30`,
                paddingLeft: 4,
              }}>
                {meta.children.map((c: ClusterNode) => {
                  // const color  = colorScale(String(c.cluster_id))
                  // const color = PALETTE[c.cluster_id % PALETTE.length]
                  const color = clusterColor(c.cluster_id)
                  const active = activeCluster === null || activeCluster === c.cluster_id
                  return (
                    <button key={c.cluster_id} onClick={() => toggleCluster(c.cluster_id)}
                      title={c.name} style={{
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
                      <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                      <span style={{ opacity: 0.45, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {c.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function AutoHeightPacking({ data, width, activeCluster, onClusterClick, activeMeta, onMetaClick }: {
  data: TopicsData; width: number
  activeCluster: number | null; onClusterClick: (id: number) => void
  activeMeta: string | null; onMetaClick: (name: string) => void
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
          activeMeta={activeMeta} onMetaClick={onMetaClick}
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
