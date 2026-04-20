/**
 * SentimentTab.tsx
 *
 * Per-ticker entity sentiment ranked by signal strength.
 * Inline styles only — matches Explorer.tsx design language (no Tailwind).
 *
 * JSON shape consumed: sentiment_{mode}.json
 * {
 *   mode, updated_at,
 *   entities: [{
 *     entity, ticker, pos, neg, neu, total, score,
 *     categories: { [cat]: {pos,neg,neu} },
 *     clusters:   [{ cluster_id, label, meta_category, pos, neg, neu, total, score }],
 *     articles:   [{ headline, date, polarity }]
 *   }]
 * }
 */

import { useEffect, useState, useCallback } from 'react'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryBreakdown { pos: number; neg: number; neu: number }

interface ClusterSentiment {
    cluster_id: number
    label: string
    meta_category: string
    pos: number; neg: number; neu: number; total: number
    score: number
}

interface ArticleSample {
    headline: string
    date: string
    polarity: string
}

interface EntitySentiment {
    entity: string
    ticker: string | null
    pos: number
    neg: number
    neu: number
    total: number
    score: number
    categories: Record<string, CategoryBreakdown>
    clusters: ClusterSentiment[]
    articles: ArticleSample[]
}

interface SentimentData {
    mode: string
    updated_at: string
    entities: EntitySentiment[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
    if (score > 0.15) return '#16a34a'
    if (score < -0.15) return '#dc2626'
    return '#6b7280'
}

function scoreBg(score: number): string {
    if (score > 0.15) return '#f0fdf4'
    if (score < -0.15) return '#fef2f2'
    return '#f9fafb'
}

function polaritySymbol(p: string): { sym: string; color: string } {
    if (p === '+') return { sym: '+', color: '#16a34a' }
    if (p === '-') return { sym: '−', color: '#dc2626' }
    return { sym: '○', color: 'var(--ink-4)' }
}

function fmtDate(d: string): string {
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtScore(s: number): string {
    return (s >= 0 ? '+' : '') + s.toFixed(2)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
    const pct = Math.round(Math.abs(score) * 100)
    const color = scoreColor(score)
    return (
        <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.2s' }} />
        </div>
    )
}

function CategoryMini({ name, data }: { name: string; data: CategoryBreakdown }) {
    const total = data.pos + data.neg + data.neu
    if (total === 0) return null
    const barH = (n: number) => Math.max(2, Math.round((n / total) * 18))
    return (
        <div style={{
            background: 'var(--white)', border: '1px solid var(--ink-6)', borderRadius: 6,
            padding: '6px 8px', minWidth: 70,
        }}>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 20 }}>
                <div style={{ width: 6, height: barH(data.pos), background: '#16a34a', borderRadius: 1 }} />
                <div style={{ width: 6, height: barH(data.neg), background: '#dc2626', borderRadius: 1 }} />
                <div style={{ width: 6, height: barH(data.neu), background: '#d1d5db', borderRadius: 1 }} />
            </div>
        </div>
    )
}

function ClusterRow({ c }: { c: ClusterSentiment }) {
    const color = scoreColor(c.score)
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0', borderBottom: '1px solid #f9fafb', fontSize: 12,
        }}>
            <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: color,
            }} />
            <div style={{ flex: 1, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.label}
            </div>
            <div style={{ color: 'var(--ink-4)', fontSize: 11, flexShrink: 0 }}>{c.meta_category}</div>
            <div style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 38, textAlign: 'right' }}>
                {fmtScore(c.score)}
            </div>
            <div style={{ color: 'var(--ink-4)', fontSize: 11, flexShrink: 0, minWidth: 30, textAlign: 'right' }}>
                {c.total}
            </div>
        </div>
    )
}

function EntityRow({
    entity: e,
    isExpanded,
    onToggle,
}: {
    entity: EntitySentiment
    isExpanded: boolean
    onToggle: () => void
}) {
    const color = scoreColor(e.score)
    const bg = isExpanded ? scoreBg(e.score) : '#fff'
    const cats = Object.entries(e.categories)

    return (
        <div style={{
            border: `1px solid ${isExpanded ? '#e5e7eb' : '#f3f4f6'}`,
            borderRadius: 8,
            background: bg,
            marginBottom: 5,
            overflow: 'hidden',
            transition: 'border-color 0.12s',
        }}>
            {/* Main row */}
            <div
                onClick={onToggle}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                }}
            >
                {/* Entity + ticker */}
                <div style={{ minWidth: 120, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{e.entity}</span>
                    {e.ticker && (
                        <span style={{
                            fontSize: 10, fontWeight: 600,
                            background: '#eff6ff', color: '#1d4ed8',
                            padding: '2px 5px', borderRadius: 4,
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {e.ticker}
                        </span>
                    )}
                </div>

                {/* Score bar */}
                <ScoreBar score={e.score} />

                {/* Top cluster preview — shown when collapsed */}
                {!isExpanded && e.clusters.length > 0 && (
                    <div style={{
                        fontSize: 11, color: 'var(--ink-4)', flexShrink: 0,
                        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {e.clusters[0].label}
                    </div>
                )}

                {/* Score value */}
                <div style={{
                    fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    color, minWidth: 42, textAlign: 'right', flexShrink: 0,
                }}>
                    {fmtScore(e.score)}
                </div>

                {/* pos / neg / neu counts */}
                <div style={{
                    display: 'flex', gap: 6, fontSize: 11,
                    fontVariantNumeric: 'tabular-nums', minWidth: 90, justifyContent: 'flex-end', flexShrink: 0,
                }}>
                    <span style={{ color: '#16a34a' }}>{e.pos}+</span>
                    <span style={{ color: '#dc2626' }}>{e.neg}−</span>
                    <span style={{ color: 'var(--ink-4)' }}>{e.neu}○</span>
                </div>

                {/* Expand chevron */}
                <div style={{ color: 'var(--ink-5)', fontSize: 11, flexShrink: 0, transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                    ▾
                </div>
            </div>

            {/* Expanded section */}
            {isExpanded && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--ink-6)' }}>

                    {/* Category mini-bars */}
                    {cats.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, marginBottom: 12 }}>
                            {cats.map(([name, data]) => (
                                <CategoryMini key={name} name={name} data={data} />
                            ))}
                        </div>
                    )}

                    {/* Clusters */}
                    {e.clusters.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 600, color: 'var(--ink-4)',
                                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
                            }}>
                                Topics
                            </div>
                            {e.clusters.map(c => (
                                <ClusterRow key={c.cluster_id} c={c} />
                            ))}
                        </div>
                    )}

                    {/* Articles */}
                    {e.articles.length > 0 && (
                        <div>
                            <div style={{
                                fontSize: 10, fontWeight: 600, color: 'var(--ink-4)',
                                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
                            }}>
                                Articles
                            </div>
                            {e.articles.map((a, i) => {
                                const { sym, color: pc } = polaritySymbol(a.polarity)
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'baseline', gap: 8,
                                        padding: '3px 0',
                                        borderBottom: i < e.articles.length - 1 ? '1px solid var(--ink-6)' : 'none',
                                        fontSize: 12,
                                    }}>
                                        <span style={{ color: pc, fontSize: 11, fontWeight: 600, flexShrink: 0, width: 12, textAlign: 'center' }}>
                                            {sym}
                                        </span>
                                        <span style={{ flex: 1, color: 'var(--ink-2)', lineHeight: 1.4 }}>{a.headline}</span>
                                        <span style={{ color: 'var(--ink-4)', fontSize: 11, flexShrink: 0 }}>{fmtDate(a.date)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SentimentTab() {
    const [data, setData] = useState<SentimentData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'recent' | 'full'>('recent')
    const [expanded, setExpanded] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'pos' | 'neg'>('all')

    useEffect(() => {
        setData(null); setError(null); setExpanded(null)
        fetch(`${BASE}/data/sentiment_${mode}.json`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<SentimentData> })
            .then(setData)
            .catch((e: Error) => setError(e.message))
    }, [mode])

    const toggle = useCallback((key: string) =>
        setExpanded(p => p === key ? null : key), [])

    // Merge same-ticker rows — sums pos/neg/neu, recalculates score, merges clusters/articles.
    // Handles JSON where "Goldman" and "Goldman Sachs" both resolve to GS.
    const deduped = Object.values(
        (data?.entities ?? []).reduce<Record<string, EntitySentiment>>((acc, e) => {
            const key = e.ticker ?? e.entity
            if (!acc[key]) {
                acc[key] = { ...e }   // keep original entity name (e.g. "Nvidia" not "NVDA")
                return acc
            }
            const m = acc[key]
            // Keep the longer/more descriptive entity name
            if (e.entity.length > m.entity.length) m.entity = e.entity
            m.pos += e.pos
            m.neg += e.neg
            m.neu += e.neu
            m.total += e.total
            m.score = m.total > 0 ? Math.round((m.pos - m.neg) / m.total * 1000) / 1000 : 0
            // Merge categories
            Object.entries(e.categories).forEach(([cat, v]) => {
                if (!m.categories[cat]) m.categories[cat] = { pos: 0, neg: 0, neu: 0 }
                m.categories[cat].pos += v.pos
                m.categories[cat].neg += v.neg
                m.categories[cat].neu += v.neu
            })
            // Merge clusters — sum counts for same cluster_id
            e.clusters.forEach(c => {
                const ec = m.clusters.find(x => x.cluster_id === c.cluster_id)
                if (ec) {
                    ec.pos += c.pos; ec.neg += c.neg; ec.neu += c.neu
                    ec.total += c.total
                    ec.score = ec.total > 0 ? Math.round((ec.pos - ec.neg) / ec.total * 1000) / 1000 : 0
                } else {
                    m.clusters.push({ ...c })
                }
            })
            m.clusters.sort((a, b) => b.total - a.total)
            // Merge articles — deduplicate by headline, keep most recent
            e.articles.forEach(a => {
                if (!m.articles.find(x => x.headline === a.headline)) {
                    m.articles.push(a)
                }
            })
            m.articles = m.articles.slice(0, 5)
            return acc
        }, {})
    )

    const entities = deduped.filter(e => {
        if (filter === 'pos') return e.score > 0.15
        if (filter === 'neg') return e.score < -0.15
        return true
    })

    const updatedAt = data?.updated_at
        ? new Date(data.updated_at).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })
        : null


    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', padding: '20px 28px 0',
            fontFamily: 'var(--font-ui)',
        }}>
            {/* Header — exact match to TopicsTab chrome */}
            <div style={{ flexShrink: 0, paddingBottom: 14, borderBottom: '1px solid var(--ink-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>
                            Sentiment
                        </h2>
                        {updatedAt && (
                            <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                                {updatedAt}
                            </p>
                        )}
                    </div>
                    {/* Toggles — same grouped style as TopicsTab mode toggle */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ display: 'flex', border: '1px solid var(--ink-5)', borderRadius: 'var(--radius-sm)', padding: 2, gap: 2 }}>
                            {(['recent', 'full'] as const).map(m => (
                                <button key={m} onClick={() => setMode(m)} style={{
                                    padding: '3px 14px', borderRadius: 4, border: 'none',
                                    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
                                    transition: 'all .12s', cursor: 'pointer',
                                    background: mode === m ? 'var(--ink)' : 'transparent',
                                    color: mode === m ? 'var(--white)' : 'var(--ink-3)',
                                }}>
                                    {m === 'recent' ? 'Recent' : 'Full'}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', border: '1px solid var(--ink-5)', borderRadius: 'var(--radius-sm)', padding: 2, gap: 2 }}>
                            {([['all', 'All'], ['pos', 'Positive'], ['neg', 'Negative']] as const).map(([v, label]) => (
                                <button key={v} onClick={() => setFilter(v)} style={{
                                    padding: '3px 10px', borderRadius: 4, border: 'none',
                                    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
                                    transition: 'all .12s', cursor: 'pointer',
                                    background: filter === v ? 'var(--ink)' : 'transparent',
                                    color: filter === v ? 'var(--white)' : 'var(--ink-3)',
                                }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats — exact match to TopicsTab stat cards */}
                {data && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[
                            { label: 'tickers', value: deduped.length },
                            { label: 'positive', value: deduped.filter(e => e.score > 0.15).length },
                            { label: 'negative', value: deduped.filter(e => e.score < -0.15).length },
                            { label: 'mentions', value: deduped.reduce((s, e) => s + e.total, 0) },
                        ].map(({ label, value }) => (
                            <div key={label} style={{
                                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--ink-6)', background: 'var(--ink-7)',
                            }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                                    {value.toLocaleString()}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 5 }}>{label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Entity list */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 20, paddingTop: 14 }}>
                {error ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
                        Could not load data — {error}
                    </div>
                ) : !data ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                        Loading…
                    </div>
                ) : entities.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                        No entities match the current filter.
                    </div>
                ) : (
                    entities.map(e => (
                        <EntityRow
                            key={e.entity}
                            entity={e}
                            isExpanded={expanded === e.entity}
                            onToggle={() => toggle(e.entity)}
                        />
                    ))
                )}
            </div>
        </div>
    )
}