import { useState, useEffect } from 'react'
import MetricsPanel from './MetricsPanel'
import PeerList from './PeerList'
import PatchControls from './PatchControls'
import AIChat from './AIChat'
import ExportButton from './ExportButton'
import CursorOverlay from './CursorOverlay'

const TABS = [
  { id: 'metrics', label: 'metrics' },
  { id: 'peers', label: 'peers' },
  { id: 'patches', label: 'patches' },
  { id: 'ai', label: 'ai' },
]

export default function Panel({ roomId, displayName, room }) {
  const [tab, setTab] = useState('metrics')
  const [localMetrics, setLocalMetrics] = useState(null)

  useEffect(() => {
    const collect = () => {
      const nav = performance.getEntriesByType('navigation')[0]
      const resources = performance.getEntriesByType('resource').slice(-20)
      const data = {
        ts: Date.now(),
        url: location.href,
        timing: nav
          ? {
              ttfb: Math.round(nav.responseStart - nav.requestStart),
              domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
              load: Math.round(nav.loadEventEnd - nav.startTime),
            }
          : null,
        resources: resources.map((r) => ({
          name: r.name.split('/').pop()?.slice(0, 40) || r.name,
          duration: Math.round(r.duration),
          size: r.transferSize || 0,
          type: r.initiatorType,
        })),
        memory: performance.memory
          ? {
              used: Math.round(performance.memory.usedJSHeapSize / 1048576),
              total: Math.round(performance.memory.totalJSHeapSize / 1048576),
            }
          : null,
        longTasks: [],
      }
      setLocalMetrics(data)
    }
    collect()
    const id = setInterval(collect, 5000)
    return () => clearInterval(id)
  }, [])

  const metrics = room.metrics || localMetrics
  const peerCount = Object.keys(room.peers || {}).length + 1

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 md:h-8 shrink-0 border-b border-[var(--color-border)] px-3 flex items-center gap-4 text-[11px] font-mono overflow-x-auto">
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              room.connected ? 'bg-[var(--color-green)]' : 'bg-[var(--color-amber)]'
            }`}
          />
          {room.connected ? 'connected' : 'connecting'}
        </span>
        <span className="text-[var(--color-muted)] shrink-0">
          {peerCount} peer{peerCount !== 1 ? 's' : ''}
        </span>
        <span className="hidden sm:inline text-[var(--color-muted)] truncate max-w-[220px]">
          {metrics?.url
            ? (() => {
                try {
                  return new URL(metrics.url).hostname
                } catch {
                  return '—'
                }
              })()
            : '—'}
        </span>
        <div className="flex-1 min-w-2" />
        <ExportButton
          metrics={metrics}
          roomId={roomId}
          peers={room.peers}
          patches={room.patches}
        />
      </div>

      {room.connectionError && (
        <div className="shrink-0 px-3 py-1.5 text-[11px] font-mono text-[var(--color-amber)] bg-[var(--color-amber)]/10 border-b border-[var(--color-amber)]/30">
          Connection error: {room.connectionError}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <nav className="shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-visible border-b md:border-b-0 md:border-r border-[var(--color-border)] md:w-28 md:py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 md:w-full text-left px-3 h-9 md:h-8 text-[12px] font-mono whitespace-nowrap transition ${
                tab === t.id
                  ? 'text-cyan bg-elevated border-b-2 md:border-b-0 md:border-r-2 border-cyan'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 overflow-auto p-3 md:p-4">
          {tab === 'metrics' && <MetricsPanel metrics={metrics} />}
          {tab === 'peers' && (
            <PeerList
              peers={room.peers}
              selfName={displayName}
              cursors={room.cursors}
              highlights={room.highlights}
            />
          )}
          {tab === 'patches' && (
            <PatchControls
              patches={room.patches}
              requests={room.patchRequests}
              onRequest={room.requestPatch}
              onVote={room.votePatch}
              onApply={room.applyPatch}
              onRevert={room.revertPatch}
              selfName={displayName}
              peerCount={peerCount}
            />
          )}
          {tab === 'ai' && <AIChat metrics={metrics} />}
        </div>
      </div>

      <div className="h-7 shrink-0 border-t border-[var(--color-border)] px-3 flex items-center text-[11px] font-mono text-[var(--color-muted)] overflow-x-auto whitespace-nowrap">
        agent must be injected on the target page · ctrl/cmd-click to highlight · room {roomId}
      </div>

      <CursorOverlay cursors={room.cursors} />
    </div>
  )
}