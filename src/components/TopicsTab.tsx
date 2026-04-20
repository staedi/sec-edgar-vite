import { useEffect, useRef, useState, useCallback } from 'react'
import CirclePacking from './CirclePacking'
import type { TopicsData, MetaCategoryNode, ClusterNode, ArticleNode, TickerInfo } from './CirclePacking'

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

function fixEncoding(s: string): string {
  return s
    .replace(/â€™/g, '\u2019').replace(/â€˜/g, '\u2018')
    .replace(/â€œ/g, '\u201C').replace(/â€/g, '\u201D')
    .replace(/â€"/g, '\u2013').replace(/â€"/g, '\u2014')
    .replace(/â/g, '\u2019').replace(/Ã©/g, '\u00e9')
    .replace(/Ã /g, '\u00e0').replace(/Ã¨/g, '\u00e8')
    // catch remaining multi-byte mojibake via TextDecoder if available
    .replace(/[\uFFFD]/g, '')
}


// ── Sentiment ─────────────────────────────────────────────────────────────────

interface SentimentEntity {
  ticker: string | null
  score: number
  clusters: { cluster_id: number; score: number }[]
}

type SentimentMap = Record<string, { global: number; byCluster: Record<number, number> }>

function sentimentColor(score: number): string {
  if (score > 0.15) return '#16a34a'
  if (score < -0.15) return '#dc2626'
  return '#9ca3af'
}

function fmtScore(score: number): string {
  return (score >= 0 ? '+' : '') + score.toFixed(2)
}

// ── Detail pane ───────────────────────────────────────────────────────────────

const PANE_W = 272

function DetailPane({ cluster, metaName, onClose, sentimentMap }: {
  cluster: ClusterNode
  metaName: string
  onClose: () => void
  sentimentMap: SentimentMap
}) {
  const [tickerMode, setTickerMode] = useState<'named' | 'semantic'>('named')
  const color = clusterColor(cluster.cluster_id)
  const named = cluster.related_tickers_named ?? []
  const semantic = cluster.related_tickers_semantic ?? []
  const tickers: TickerInfo[] = tickerMode === 'named' ? named : semantic
  const hasNamed = named.length > 0
  const hasSemantic = semantic.length > 0
  const hasAnyTickers = hasNamed || hasSemantic

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: PANE_W,
      background: 'var(--white)', borderLeft: '1px solid var(--ink-6)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)',
      zIndex: 10, boxShadow: '-4px 0 16px rgba(0,0,0,0.04)',
    }}>

      {/* Header — fixed */}
      <div style={{ flexShrink: 0, padding: '16px 16px 12px', borderBottom: '1px solid var(--ink-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--ink-4)'
            }}>
              {metaName}
            </p>
            <h3 style={{
              margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--ink)',
              lineHeight: 1.25, letterSpacing: '-0.01em',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {cluster.name.replace(/^"|"$/g, '')}
            </h3>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--ink-4)', fontSize: 18, lineHeight: 1,
            padding: '0 4px', marginTop: -2, flexShrink: 0,
          }}>×</button>
        </div>
        {/* Stats row */}
        <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
          {[
            { label: 'Articles', value: cluster.count },
            { label: 'Named', value: named.length },
            { label: 'Semantic', value: semantic.length },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{
                margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', color: 'var(--ink-4)'
              }}>{label}</p>
              <p style={{
                margin: '1px 0 0', fontSize: 17, fontWeight: 700,
                color: 'var(--ink)', fontVariantNumeric: 'tabular-nums'
              }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tickers — fixed, no scroll */}
      {hasAnyTickers && (
        <div style={{ flexShrink: 0, padding: '10px 16px 12px', borderBottom: '1px solid var(--ink-6)' }}>
          {hasNamed && hasSemantic && (
            <div style={{
              display: 'flex', marginBottom: 10,
              border: '1px solid var(--ink-5)', borderRadius: 6, padding: 2, gap: 2,
            }}>
              {(['named', 'semantic'] as const).map(m => (
                <button key={m} onClick={() => setTickerMode(m)} style={{
                  flex: 1, padding: '3px 0', borderRadius: 4, border: 'none',
                  fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  cursor: 'pointer', transition: 'all .12s',
                  background: tickerMode === m ? 'var(--ink)' : 'transparent',
                  color: tickerMode === m ? 'var(--white)' : 'var(--ink-3)',
                }}>
                  {m === 'named' ? 'Named' : 'Semantic'}
                </button>
              ))}
            </div>
          )}
          {tickers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tickers.map(t => {
                const sent = sentimentMap[t.ticker]
                const score = sent?.byCluster[cluster.cluster_id] ?? sent?.global ?? null
                const sColor = score !== null ? sentimentColor(score) : 'var(--ink-5)'
                return (
                  <div key={t.ticker} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color,
                      letterSpacing: '0.02em', flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}>{t.ticker}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 400, color: 'var(--ink-3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>{t.name}</span>
                    {score !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: sColor,
                        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      }}>{fmtScore(score)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-4)' }}>
              No {tickerMode} tickers found
            </p>
          )}
        </div>
      )}

      {/* Articles — scrollable, fills remaining height */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <p style={{
          margin: '10px 16px 6px', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)'
        }}>
          Articles
        </p>
        {cluster.children.map((art: ArticleNode) => (
          <div key={art.hash} style={{ padding: '7px 16px', borderBottom: '1px solid var(--ink-7)' }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 500,
              color: 'var(--ink)', lineHeight: 1.35
            }}>
              {fixEncoding(art.name.replace(/^In this article[,\s]*/i, ''))}
            </p>
            <p style={{
              margin: '3px 0 0', fontSize: 10, fontWeight: 400,
              color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums'
            }}>
              {art.provider} · {art.article_date.slice(0, 10)}
            </p>
          </div>
        ))}
      </div>

    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TopicsTab() {
  const [data, setData] = useState<TopicsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'recent' | 'full'>('recent')
  const [sentimentMap, setSentimentMap] = useState<SentimentMap>({})
  const [activeCluster, setActiveCluster] = useState<number | null>(null)
  const [activeMeta, setActiveMeta] = useState<string | null>(null)

  const vizRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    setData(null); setError(null); setActiveCluster(null); setActiveMeta(null)
    fetch(`${BASE}/data/topics_${mode}.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<TopicsData> })
      .then(d => setData(d))
      .catch((e: Error) => setError(e.message))
    // Fetch matching sentiment data and build lookup map
    fetch(`${BASE}/data/sentiment_${mode}.json`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { entities: SentimentEntity[] } | null) => {
        if (!d) return
        const map: SentimentMap = {}
        d.entities.forEach(e => {
          if (!e.ticker) return
          map[e.ticker] = {
            global: e.score,
            byCluster: Object.fromEntries(e.clusters.map(c => [c.cluster_id, c.score])),
          }
        })
        setSentimentMap(map)
      })
      .catch(() => { })  // sentiment is optional — fail silently
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

  const toggleCluster = useCallback((id: number) => {
    setActiveCluster(p => {
      if (p === id) return null
      if (data) {
        const parentMeta = data.children.find((m: MetaCategoryNode) =>
          m.children.some((c: ClusterNode) => c.cluster_id === id)
        )
        if (parentMeta) setActiveMeta(parentMeta.name)
      }
      return id
    })
  }, [data])

  const toggleMeta = useCallback((name: string) => {
    setActiveMeta(p => p === name ? null : name)
    setActiveCluster(null)
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

  const selectedCluster = activeCluster !== null && data
    ? allClusters(data).find(c => c.cluster_id === activeCluster) ?? null
    : null
  const selectedMeta = selectedCluster && data
    ? data.children.find(m => m.children.some(c => c.cluster_id === activeCluster))?.name ?? ''
    : ''

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
              <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
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
                {m === 'recent' ? 'Recent' : 'Full'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Topics', value: data.children.length },
              { label: 'Clusters', value: allClusters(data).length },
              { label: 'Articles', value: allClusters(data).reduce((s, c) => s + c.count, 0) },
              { label: 'Top Cluster', value: Math.max(...allClusters(data).map(c => c.count)) },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ink-6)', background: 'var(--ink-7)',
              }}>
                <span style={{
                  fontSize: 18, fontWeight: 700, color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {value.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 5 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Viz + detail pane ── */}
      <div ref={vizRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {error ? (
          <Centered><span style={{ color: '#ef4444', fontSize: 13 }}>Could not load data — {error}</span></Centered>
        ) : !data || !width ? (
          <Centered><span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Loading…</span></Centered>
        ) : data.children.length === 0 ? (
          <Centered><span style={{ color: 'var(--ink-4)', fontSize: 13 }}>No clusters found.</span></Centered>
        ) : (
          <>
            <AutoHeightPacking
              data={data} width={width}
              activeCluster={activeCluster} onClusterClick={toggleCluster}
              activeMeta={activeMeta} onMetaClick={toggleMeta}
            />
            {selectedCluster && (
              <DetailPane
                cluster={selectedCluster}
                metaName={selectedMeta}
                onClose={clearAll}
                sentimentMap={sentimentMap}
              />
            )}
          </>
        )}
      </div>

      {/* ── Legend ── */}
      {data && data.children.length > 0 && (
        <div style={{ flexShrink: 0, padding: '8px 0 12px', borderTop: '1px solid var(--ink-6)' }}>
          {/* Meta pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {data.children.map((meta: MetaCategoryNode) => {
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
                    background: metaColor, opacity: metaActive ? 1 : 0.3, display: 'inline-block',
                  }} />
                  {meta.name}
                  <span style={{
                    opacity: 0.5, fontWeight: 400, fontSize: 10,
                    fontVariantNumeric: 'tabular-nums'
                  }}>
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

          {/* Cluster pills — only for expanded meta */}
          {activeMeta !== null && (() => {
            const meta = data.children.find((m: MetaCategoryNode) => m.name === activeMeta)
            if (!meta) return null
            const metaColor = metaClusterColor(meta.name)
            return (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 5,
                marginTop: 6, paddingTop: 6,
                borderTop: `1px solid ${metaColor}30`, paddingLeft: 4,
              }}>
                {meta.children.map((c: ClusterNode) => {
                  const color = clusterColor(c.cluster_id)
                  const isSelected = activeCluster === c.cluster_id
                  const dimmed = activeCluster !== null && !isSelected
                  return (
                    <button key={c.cluster_id} onClick={() => toggleCluster(c.cluster_id)}
                      title={c.name} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20,
                        border: `1px solid ${isSelected ? color : dimmed ? 'var(--ink-6)' : 'var(--ink-5)'}`,
                        background: isSelected ? `${color}30` : 'transparent',
                        color: isSelected ? color : dimmed ? 'var(--ink-5)' : 'var(--ink-4)',
                        fontSize: 12, fontWeight: isSelected ? 700 : 500, fontFamily: 'var(--font-ui)',
                        transition: 'all .12s', cursor: 'pointer', opacity: dimmed ? 0.5 : 1,
                      }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: color, opacity: isSelected ? 1 : 0.3, display: 'inline-block',
                      }} />
                      <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                      <span style={{ opacity: 0.45, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function AutoHeightPacking({ data, width, activeCluster, onClusterClick, activeMeta, onMetaClick }: {
  data: TopicsData; width: number
  activeCluster: number | null; onClusterClick: (id: number) => void
  activeMeta: string | null; onMetaClick: (name: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const initial = Math.floor(el.getBoundingClientRect().height)
    if (initial > 0) setHeight(initial)
    const ro = new ResizeObserver(([entry]) =>
      setHeight(Math.floor(entry.contentRect.height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {height > 0 && (
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