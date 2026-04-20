import { useState } from 'react'
import TopicsTab from './components/TopicsTab'
import PlaceholderTab from './components/PlaceholderTab'
import SentimentTab from './components/SentimentTab'

type Tab = 'topics' | 'sentiment' | 'graph' | 'edgar'

const TABS: { id: Tab; label: string }[] = [
  { id: 'topics', label: 'Topics' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'graph', label: 'Graph' },
  { id: 'edgar', label: 'EDGAR' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('topics')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: 'var(--white)',
    }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 52, borderBottom: '1px solid var(--ink-5)',
        flexShrink: 0, background: 'var(--white)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logomark */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect width="22" height="22" rx="5" fill="var(--ink)" />
            <polyline points="4,16 8,10 12,13 18,6"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Financial News Explorer
          </span>
        </div>

        {/* Tab bar */}
        <nav style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '5px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: tab === t.id ? 'var(--ink)' : 'transparent',
              color: tab === t.id ? 'var(--white)' : 'var(--ink-3)',
              fontSize: 13, fontWeight: 500,
              transition: 'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ width: 180 }} /> {/* balance header */}
      </header>

      {/* ── Content — fills remaining height, scrolls internally ─────────── */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'topics' && <TopicsTab />}
        {tab === 'sentiment' && <SentimentTab />}
        {tab === 'graph' && <PlaceholderTab label="Graph" />}
        {tab === 'edgar' && <PlaceholderTab label="EDGAR" />}
      </main>
    </div>
  )
}
