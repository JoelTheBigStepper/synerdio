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
        longTasks: window.__synerdioLongTasks || [],
      }
      setLocalMetrics(data)
      room.broadcastMetrics?.(data)
    }

    collect()
    const id = setInterval(collect, 4000)
    return () => clearInterval(id)
  }, [room])

  useEffect(() => {
    if (!window.PerformanceObserver) return
    try {
      const obs = new PerformanceObserver((list) => {
        if (!window.__synerdioLongTasks) window.__synerdioLongTasks = []
        list.getEntries().forEach((e) => {
          window.__synerdioLongTasks.push({
            duration: Math.round(e.duration),
            start: Math.round(e.startTime),
          })
        })
        window.__synerdioLongTasks = window.__synerdioLongTasks.slice(-15)
      })
      obs.observe({ type: 'longtask', buffered: true })
      return () => obs.disconnect()
    } catch (_) {}
  }, [])

  const metrics = room.metrics || localMetrics
  const peerCount = Object.keys(room.peers || {}).length + 1

  return (
    <div className="h-full flex flex-col">
      {/* Status strip */}
      <div className="h-8 shrink-0 border-b border-[var(--color-border)] px-3 flex items-center gap-4 text-[11px] font-mono">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              room.connected ? 'bg-[var(--color-green)]' : 'bg-[var(--color-amber)]'
            }`}
          />
          {room.connected ? 'connected' : 'connecting'}
        </span>
        <span className="text-[var(--color-muted)]">{peerCount} peer{peerCount !== 1 ? 's' : ''}</span>
        <span className="text-[var(--color-muted)] truncate max-w-[200px]">
          {metrics?.url ? new URL(metrics.url).hostname : '—'}
        </span>
        <div className="flex-1" />
        <ExportButton metrics={metrics} roomId={roomId} peers={room.peers} patches={room.patches} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Side nav */}
        <nav className="w-28 shrink-0 border-r border-[var(--color-border)] py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-3 h-8 text-[12px] font-mono transition ${
                tab === t.id
                  ? 'text-[var(--color-cyan)] bg-[var(--color-elevated)] border-r-2 border-[var(--color-cyan)]'
                  : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-auto p-4">
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
            />
          )}
          {tab === 'ai' && <AIChat metrics={metrics} />}
        </div>
      </div>

      {/* Footer hint */}
      <div className="h-7 shrink-0 border-t border-[var(--color-border)] px-3 flex items-center text-[11px] font-mono text-[var(--color-muted)]">
        inject agent on target page · ctrl/cmd-click to highlight · room {roomId}
      </div>

      <CursorOverlay cursors={room.cursors} />
    </div>
  )
}