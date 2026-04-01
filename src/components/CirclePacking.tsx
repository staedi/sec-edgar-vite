import { useMemo, useState, useCallback } from 'react'
import { hierarchy, pack } from 'd3-hierarchy'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArticleNode {
  name: string; hash: string; article_date: string; provider: string; value: number
}
export interface ClusterNode {
  cluster_id: number; name: string; count: number; children: ArticleNode[]
}
export interface TopicsData {
  name: 'root'; mode?: string; updated_at: string; children: ClusterNode[]
}
export interface CirclePackingProps {
  data: TopicsData; width: number; height: number
  activeCluster?: number | null; onClusterClick?: (id: number) => void
}

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#4e9af1', '#f0a653', '#5ec98b', '#e06c75', '#c792ea',
  '#56b6c2', '#e5c07b', '#98c379', '#f07178', '#7986cb',
  '#4db6ac', '#ff8a65',
]

// Deterministic color by cluster_id — never changes regardless of which
// clusters are present or in what order they appear in the data.
function clusterColor(cluster_id: number): string {
  return PALETTE[cluster_id % PALETTE.length]
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
  data, width, height, activeCluster: ext, onClusterClick,
}: CirclePackingProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; sub: string } | null>(null)
  const [internal, setInternal] = useState<number | null>(null)
  const active = ext !== undefined ? ext : internal

  const handleClick = useCallback((id: number) => {
    if (onClusterClick) onClusterClick(id)
    else setInternal(p => p === id ? null : id)
  }, [onClusterClick])

  const PAD = 12

  const root = useMemo(() => {
    const h = hierarchy<TopicsData | ClusterNode | ArticleNode>(data as TopicsData)
      .sum(d => ('value' in d ? (d as ArticleNode).value : 0))
      .sort((a, b) => {
        // Primary: value descending
        const diff = (b.value ?? 0) - (a.value ?? 0)
        if (diff !== 0) return diff
        // Tiebreaker: stable sort by cluster_id or hash so layout is
        // identical across mode switches
        const aId = 'cluster_id' in a.data
          ? (a.data as ClusterNode).cluster_id
          : (a.data as ArticleNode).hash
        const bId = 'cluster_id' in b.data
          ? (b.data as ClusterNode).cluster_id
          : (b.data as ArticleNode).hash
        return String(aId) < String(bId) ? -1 : String(aId) > String(bId) ? 1 : 0
      })
    return pack<TopicsData | ClusterNode | ArticleNode>()
      .size([width - PAD * 2, height - PAD * 2])
      .padding(8)(h)
  }, [data, width, height])

  return (
    <div style={{ position: 'relative', width, height, userSelect: 'none' }}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <g transform={`translate(${PAD},${PAD})`}>
          {root.descendants().map((node, i) => {
            if (node.depth === 0) return null
            const isCluster = node.depth === 1
            const cd = isCluster
              ? (node.data as ClusterNode)
              : (node.parent!.data as ClusterNode)
            const color = clusterColor(cd.cluster_id)
            const on = active === null || active === cd.cluster_id

            if (isCluster) {
              const fs = Math.min(13, Math.max(9, node.r / 5))
              const lh = fs * 1.3
              const maxC = Math.max(8, Math.floor(node.r / 5.2))
              const lines = wrapLabel(fixEncoding(cd.name), maxC).slice(0, 2)
              const show = node.r > 36
              const ty = node.y - (lines.length * lh) / 2 + lh * 0.4

              return (
                <g key={`c-${cd.cluster_id}`} style={{ cursor: 'pointer' }}
                  onClick={() => handleClick(cd.cluster_id)}
                  onMouseEnter={e => setTooltip({
                    x: e.clientX, y: e.clientY,
                    label: fixEncoding(cd.name),
                    sub: `${cd.count} article${cd.count !== 1 ? 's' : ''}`,
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

            const art = node.data as ArticleNode
            return (
              <circle key={`a-${art.hash || i}`}
                cx={node.x} cy={node.y} r={Math.max(node.r, 2.5)}
                fill={color} fillOpacity={on ? 0.65 : 0.1}
                stroke={color} strokeWidth={0.5} strokeOpacity={on ? 0.25 : 0}
                style={{ transition: 'all 0.18s ease', cursor: 'default' }}
                onMouseEnter={e => setTooltip({
                  x: e.clientX, y: e.clientY,
                  label: truncate(art.name, 80),
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
          zIndex: 9999, pointerEvents: 'none', maxWidth: 280,
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
        </div>
      )}
    </div>
  )
}