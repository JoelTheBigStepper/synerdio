import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, Crosshair, X as XIcon } from 'lucide-react'
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

// How long the "propose a fix?" banner stays up after a highlight, if
// nobody acts on it or dismisses it.
const HIGHLIGHT_BANNER_TTL_MS = 30000

export default function Panel({ roomId, displayName, room }) {
  const [tab, setTab] = useState('metrics')
  const [localMetrics, setLocalMetrics] = useState(null)
  const [dismissedHighlightTs, setDismissedHighlightTs] = useState(0)
  const [focusRequest, setFocusRequest] = useState(null)
  const [now, setNow] = useState(Date.now())

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
        // Tagged so peers' getMetrics handler can tell this apart from
        // real agent-sourced metrics about the target page, and never let
        // it overwrite those.
        source: 'panel',
      }
      setLocalMetrics(data)
      room.broadcastMetrics?.(data)
    }
    collect()
    const id = setInterval(collect, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ticks so the highlight banner's age-based expiry re-evaluates even if
  // nothing else triggers a re-render for a while.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  const metrics = room.metrics || localMetrics
  const peerCount = room.peerCount ?? Object.keys(room.peers || {}).length + 1

  const showHighlightBanner = useMemo(() => {
    const h = room.lastHighlight
    if (!h) return false
    if (h.ts <= dismissedHighlightTs) return false
    if (now - h.ts > HIGHLIGHT_BANNER_TTL_MS) return false
    return true
  }, [room.lastHighlight, dismissedHighlightTs, now])

  const proposeFromBanner = () => {
    const h = room.lastHighlight
    if (!h) return
    setFocusRequest({ selector: h.selector, key: h.ts })
    setDismissedHighlightTs(h.ts)
    setTab('patches')
  }

  const dismissBanner = () => {
    if (room.lastHighlight) setDismissedHighlightTs(room.lastHighlight.ts)
  }

  // Distinguishes "still negotiating" from "joined the room but nobody
  // else is here yet" from "something actually went wrong" — previously
  // all three looked identical (an ambiguous amber dot).
  let statusLabel = 'connecting'
  let statusColor = 'bg-[var(--color-amber)] animate-pulse'
  if (room.connectionError) {
    statusLabel = 'connection error'
    statusColor = 'bg-[var(--color-red)]'
  } else if (room.connected && peerCount > 1) {
    statusLabel = 'connected'
    statusColor = 'bg-[var(--color-green)]'
  } else if (room.connected) {
    statusLabel = 'waiting for peers'
    statusColor = 'bg-[var(--color-amber)]'
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 md:h-8 shrink-0 border-b border-[var(--color-border)] px-3 flex items-center gap-4 text-[11px] font-mono overflow-x-auto">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          {statusLabel}
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
        <div className="shrink-0 px-3 py-1.5 text-[11px] font-mono text-[var(--color-amber)] bg-[var(--color-amber)]/10 border-b border-[var(--color-amber)]/30 flex items-center gap-3">
          <span>Connection error: {room.connectionError}</span>
          <button
            onClick={room.reconnect}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--color-amber)]/50 hover:bg-[var(--color-amber)]/20 transition shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            retry
          </button>
        </div>
      )}

      {/* Visible on every tab — this is what makes a Ctrl/Cmd-click
          reliably surface to everyone, instead of depending on someone
          remembering to check the Patches tab. */}
      {showHighlightBanner && tab !== 'patches' && (
        <div className="shrink-0 px-3 py-1.5 text-[11px] font-mono text-[var(--color-cyan)] bg-[var(--color-cyan)]/10 border-b border-[var(--color-cyan)]/30 flex items-center gap-3">
          <Crosshair className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {room.lastHighlight?.name || 'Someone'} highlighted{' '}
            <span className="font-semibold">{room.lastHighlight?.selector}</span>
          </span>
          <div className="flex-1" />
          <button
            onClick={proposeFromBanner}
            className="px-2 py-0.5 rounded border border-[var(--color-cyan)]/50 hover:bg-[var(--color-cyan)]/20 transition shrink-0"
          >
            propose fix
          </button>
          <button onClick={dismissBanner} className="text-[var(--color-muted)] hover:text-[var(--color-text)] shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
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
              voterCount={room.voterCount ?? peerCount}
              highlights={room.highlights}
              focusTarget={focusRequest}
            />
          )}
          {tab === 'ai' && <AIChat metrics={metrics} />}
        </div>
      </div>

      <div className="h-7 shrink-0 border-t border-[var(--color-border)] px-3 flex items-center text-[11px] font-mono text-[var(--color-muted)] overflow-x-auto whitespace-nowrap">
        agent must be injected on the target page · cmd/ctrl-click to highlight · room {roomId}
      </div>

      <CursorOverlay cursors={room.cursors} />
    </div>
  )
}