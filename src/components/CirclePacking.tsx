import { useMemo, useState, useCallback } from 'react'
import { hierarchy, pack } from 'd3-hierarchy'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArticleNode {
  name: string; summary?: string; hash: string; chunk_key?: string
  article_date: string; provider: string; value: number
}
export interface ClusterNode {
  cluster_id: number; name: string; count: number
  children: ArticleNode[]; related_tickers?: string[]
}
export interface MetaCategoryNode {
  name: string; count: number; children: ClusterNode[]
}
export interface TopicsData {
  name: 'root'; mode?: string; updated_at: string; children: MetaCategoryNode[]
}
export interface CirclePackingProps {
  data: TopicsData; width: number; height: number
  activeCluster?: number | null; onClusterClick?: (id: number) => void
  activeMeta?: string | null; onMetaClick?: (name: string) => void
}

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#4e9af1', '#f0a653', '#5ec98b', '#e06c75', '#c792ea',
  '#56b6c2', '#e5c07b', '#98c379', '#f07178', '#7986cb',
  '#4db6ac', '#ff8a65',
]
const META_PALETTE = [
  '#7c8cf8', '#f59e6b', '#34d399', '#f87171', '#a78bfa',
  '#22d3ee', '#fbbf24', '#4ade80',
]

// Deterministic color by cluster_id — stable across mode switches
function clusterColor(cluster_id: number): string {
  return PALETTE[cluster_id % PALETTE.length]
}
function metaColor(metaName: string): string {
  // Simple hash of the name string for stable color assignment
  let hash = 0
  for (let i = 0; i < metaName.length; i++) hash = (hash * 31 + metaName.charCodeAt(i)) >>> 0
  return META_PALETTE[hash % META_PALETTE.length]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fixEncoding(s: string) {
  return s.replace(/â€™/g, '\u2019').replace(/â€œ/g, '\u201C')
    .replace(/â€/g, '\u201D').replace(/â€"/g, '\u2013').replace(/â/g, '\u2019')
}
function truncate(s: string, n: number) {
  const f = fixEncoding(s); return f.length > n ? f.slice(0, n - 1) + '…' : f
}
function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? cur + ' ' + w : w
    if (candidate.length > maxChars && cur) { lines.push(cur); cur = w }
    else cur = candidate
  }
  if (cur) lines.push(cur)
  return lines
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CirclePacking({
  data, width, height,
  activeCluster: extCluster, onClusterClick,
  activeMeta: extMeta, onMetaClick,
}: CirclePackingProps) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; label: string; sub: string; extra?: string
  } | null>(null)
  const [internalCluster, setInternalCluster] = useState<number | null>(null)
  const [internalMeta, setInternalMeta] = useState<string | null>(null)

  const activeCluster = extCluster !== undefined ? extCluster : internalCluster
  const activeMeta = extMeta !== undefined ? extMeta : internalMeta

  const handleClusterClick = useCallback((id: number) => {
    if (onClusterClick) onClusterClick(id)
    else setInternalCluster(p => p === id ? null : id)
  }, [onClusterClick])

  const handleMetaClick = useCallback((name: string) => {
    if (onMetaClick) onMetaClick(name)
    else setInternalMeta(p => p === name ? null : name)
  }, [onMetaClick])

  const PAD = 12

  const root = useMemo(() => {
    const h = hierarchy<TopicsData | MetaCategoryNode | ClusterNode | ArticleNode>(data as TopicsData)
      .sum(d => ('value' in d ? (d as ArticleNode).value : 0))
      .sort((a, b) => {
        // Primary: value descending
        const diff = (b.value ?? 0) - (a.value ?? 0)
        if (diff !== 0) return diff
        // Stable tiebreaker — prevents layout shift when switching modes
        const aKey = 'cluster_id' in a.data
          ? String((a.data as ClusterNode).cluster_id)
          : 'hash' in a.data
            ? (a.data as ArticleNode).hash
            : (a.data as MetaCategoryNode).name
        const bKey = 'cluster_id' in b.data
          ? String((b.data as ClusterNode).cluster_id)
          : 'hash' in b.data
            ? (b.data as ArticleNode).hash
            : (b.data as MetaCategoryNode).name
        return aKey < bKey ? -1 : aKey > bKey ? 1 : 0
      })
    return pack<TopicsData | MetaCategoryNode | ClusterNode | ArticleNode>()
      .size([width - PAD * 2, height - PAD * 2])
      .padding(node => node.depth === 0 ? 12 : node.depth === 1 ? 4 : 2)(h)
  }, [data, width, height])

  return (
    <div style={{ position: 'relative', width, height, userSelect: 'none' }}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <g transform={`translate(${PAD},${PAD})`}>
          {root.descendants().map((node, i) => {
            if (node.depth === 0) return null

            // ── depth 1: meta-category ring ──────────────────────────────
            if (node.depth === 1) {
              const meta = node.data as MetaCategoryNode
              const color = metaColor(meta.name)
              const isActive = activeMeta === null || activeMeta === meta.name
              const show = node.r > 52
              const fs = Math.min(11, Math.max(8, node.r / 8))

              return (
                <g key={`m-${meta.name}`} style={{ cursor: 'pointer' }}
                  onClick={() => handleMetaClick(meta.name)}
                  onMouseEnter={e => setTooltip({
                    x: e.clientX, y: e.clientY,
                    label: meta.name,
                    sub: `${meta.children.length} cluster${meta.children.length !== 1 ? 's' : ''} · ${meta.count} articles`,
                  })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle cx={node.x} cy={node.y} r={node.r}
                    fill={color} fillOpacity={isActive ? 0.07 : 0.02}
                    stroke={color} strokeWidth={isActive ? 1.5 : 0.8}
                    strokeOpacity={isActive ? 0.45 : 0.15}
                    strokeDasharray="4 3"
                    style={{ transition: 'all 0.18s ease' }}
                  />
                  {show && (
                    <text x={node.x} y={node.y - node.r + fs + 5}
                      textAnchor="middle" fontSize={fs} fontWeight={500}
                      fontFamily="'DM Sans', system-ui, sans-serif"
                      fill={color} fillOpacity={isActive ? 0.75 : 0.25}
                      style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill-opacity 0.18s' }}
                    >{fixEncoding(meta.name)}</text>
                  )}
                </g>
              )
            }

            // ── depth 2: cluster bubble ───────────────────────────────────
            if (node.depth === 2) {
              const cd = node.data as ClusterNode
              const metaName = (node.parent!.data as MetaCategoryNode).name
              const color = clusterColor(cd.cluster_id)
              const metaOn = activeMeta === null || activeMeta === metaName
              const clusterOn = activeCluster === null || activeCluster === cd.cluster_id
              const on = metaOn && clusterOn
              const fs = Math.min(13, Math.max(9, node.r / 5))
              const lh = fs * 1.3
              const maxC = Math.max(8, Math.floor(node.r / 5.2))
              const lines = wrapLabel(fixEncoding(cd.name), maxC).slice(0, 2)
              const show = node.r > 36
              const ty = node.y - (lines.length * lh) / 2 + lh * 0.4

              return (
                <g key={`c-${cd.cluster_id}`} style={{ cursor: 'pointer' }}
                  onClick={() => handleClusterClick(cd.cluster_id)}
                  onMouseEnter={e => setTooltip({
                    x: e.clientX, y: e.clientY,
                    label: fixEncoding(cd.name),
                    sub: `${cd.count} article${cd.count !== 1 ? 's' : ''}`,
                    extra: cd.related_tickers?.length
                      ? cd.related_tickers.join('  ·  ')
                      : undefined,
                  })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle cx={node.x} cy={node.y} r={node.r}
                    fill={color} fillOpacity={on ? 0.13 : 0.03}
                    stroke={color} strokeWidth={on ? 1.5 : 0.8}
                    strokeOpacity={on ? 0.55 : 0.18}
                    style={{ transition: 'all 0.18s ease' }}
                  />
                  {show && lines.map((line, li) => (
                    <text key={li} x={node.x} y={ty + li * lh}
                      textAnchor="middle" fontSize={fs} fontWeight={600}
                      fontFamily="'DM Sans', system-ui, sans-serif"
                      fill={color} fillOpacity={on ? 0.88 : 0.22}
                      style={{ transition: 'fill-opacity 0.18s', pointerEvents: 'none', userSelect: 'none' }}
                    >{line}</text>
                  ))}
                  {show && (
                    <text x={node.x} y={node.y + node.r - 9}
                      textAnchor="middle" fontSize={Math.min(9, fs * 0.8)}
                      fontFamily="'DM Mono', monospace"
                      fill={color} fillOpacity={on ? 0.4 : 0.12}
                      style={{ transition: 'fill-opacity 0.18s', pointerEvents: 'none', userSelect: 'none' }}
                    >{cd.count}</text>
                  )}
                </g>
              )
            }

            // ── depth 3: article dot ──────────────────────────────────────
            const art = node.data as ArticleNode
            const cd = node.parent!.data as ClusterNode
            const metaName = (node.parent!.parent!.data as MetaCategoryNode).name
            const color = clusterColor(cd.cluster_id)
            const metaOn = activeMeta === null || activeMeta === metaName
            const clusterOn = activeCluster === null || activeCluster === cd.cluster_id
            const on = metaOn && clusterOn

            return (
              <circle key={`a-${art.hash || i}`}
                cx={node.x} cy={node.y} r={Math.max(node.r, 2.5)}
                fill={color} fillOpacity={on ? 0.65 : 0.08}
                stroke={color} strokeWidth={0.5} strokeOpacity={on ? 0.25 : 0}
                style={{ transition: 'all 0.18s ease', cursor: 'default' }}
                onMouseEnter={e => setTooltip({
                  x: e.clientX, y: e.clientY,
                  label: truncate(art.summary || art.name, 120),
                  sub: `${art.provider} · ${art.article_date.slice(0, 10)}`,
                })}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </g>
      </svg>

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
          zIndex: 9999, pointerEvents: 'none', maxWidth: 300,
          background: 'rgba(15,17,23,0.93)', borderRadius: 8,
          padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 500, color: '#fff',
            fontFamily: "'DM Sans',system-ui", lineHeight: 1.4
          }}>{tooltip.label}</p>
          <p style={{
            margin: '4px 0 0', fontSize: 11, color: '#9ca3af',
            fontFamily: "'DM Mono',monospace"
          }}>{tooltip.sub}</p>
          {tooltip.extra && (
            <p style={{
              margin: '5px 0 0', fontSize: 11, color: '#7986cb',
              fontFamily: "'DM Mono',monospace", letterSpacing: '0.03em'
            }}>
              {tooltip.extra}
            </p>
          )}
        </div>
      )}
    </div>
  )
}