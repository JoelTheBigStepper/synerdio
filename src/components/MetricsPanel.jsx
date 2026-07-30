import { Activity, Clock, HardDrive, AlertTriangle, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

function safeHostname(url) {
  if (!url) return '—'
  try {
    return new URL(url).hostname
  } catch {
    return '—'
  }
}

// These thresholds are informal rules of thumb for reading Navigation
// Timing data at a glance — not an official Core Web Vitals score (this
// isn't measuring LCP/CLS/INP).
function rate(value, good, fair) {
  if (value == null) return null
  if (value <= good) return 'good'
  if (value <= fair) return 'fair'
  return 'poor'
}

const RATING_STYLES = {
  good: { color: 'text-green', bg: 'bg-green/10', border: 'border-green/30', icon: CheckCircle2, label: 'Good' },
  fair: { color: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/30', icon: AlertCircle, label: 'Could be better' },
  poor: { color: 'text-red', bg: 'bg-red/10', border: 'border-red/30', icon: XCircle, label: 'Slow' },
}

export default function MetricsPanel({ metrics }) {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-slate">
        Collecting metrics…
      </div>
    )
  }

  const { timing, resources = [], memory, longTasks = [], url, ts } = metrics

  const ttfbRating = rate(timing?.ttfb, 200, 600)
  const domRating = rate(timing?.domContentLoaded, 1500, 3000)
  const loadRating = rate(timing?.load, 2500, 5000)
  const memPct = memory ? Math.round((memory.used / memory.total) * 100) : null
  const memRating = rate(memPct, 50, 80)
  const slowResources = resources.filter((r) => r.duration > 300)
  const longTaskRating = longTasks.length === 0 ? 'good' : longTasks.length <= 3 ? 'fair' : 'poor'

  // Worst rating across everything we can score, for the one-line summary.
  const ratings = [ttfbRating, domRating, loadRating, memRating, longTaskRating].filter(Boolean)
  const overall = ratings.includes('poor') ? 'poor' : ratings.includes('fair') ? 'fair' : ratings.length ? 'good' : null

  const overallCopy = {
    good: 'This page is loading and responding quickly — no red flags in the current sample.',
    fair: 'This page is usable but showing some slowness — worth a closer look below.',
    poor: 'This page is showing real performance problems — see what\'s flagged below.',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan" />
          Live Metrics
        </h3>
        <span className="text-xs text-slate font-mono">
          {safeHostname(url)} · {ts ? new Date(ts).toLocaleTimeString() : ''}
        </span>
      </div>

      {/* One-line plain-English summary */}
      {overall && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${RATING_STYLES[overall].bg} ${RATING_STYLES[overall].border} border ${RATING_STYLES[overall].color}`}>
          {(() => {
            const Icon = RATING_STYLES[overall].icon
            return <Icon className="w-4 h-4 shrink-0" />
          })()}
          <span>{overallCopy[overall]}</span>
        </div>
      )}

      {/* Timing cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Server response"
          sublabel="TTFB"
          value={timing?.ttfb != null ? `${timing.ttfb} ms` : '—'}
          rating={ttfbRating}
          icon={<Clock className="w-3.5 h-3.5" />}
          explain="How long the server took to start responding. High values usually mean a slow backend, not the browser."
        />
        <MetricCard
          label="Page interactive"
          sublabel="DOM Content Loaded"
          value={timing?.domContentLoaded != null ? `${timing.domContentLoaded} ms` : '—'}
          rating={domRating}
          icon={<Clock className="w-3.5 h-3.5" />}
          explain="How long until the HTML was parsed and buttons/links were ready to work."
        />
        <MetricCard
          label="Fully loaded"
          sublabel="Load"
          value={timing?.load != null ? `${timing.load} ms` : '—'}
          rating={loadRating}
          icon={<Clock className="w-3.5 h-3.5" />}
          explain="How long until every image, script, and stylesheet on the page finished loading."
        />
        <MetricCard
          label="Memory used"
          sublabel="JS Heap"
          value={memory ? `${memory.used} / ${memory.total} MB${memPct != null ? ` (${memPct}%)` : ''}` : '—'}
          rating={memRating}
          icon={<HardDrive className="w-3.5 h-3.5" />}
          explain="How much browser memory this page is using. Steadily climbing over time can mean a memory leak."
        />
      </div>

      {/* Long tasks */}
      <div>
        <h4 className="text-sm font-medium mb-1 flex items-center gap-1.5">
          <AlertTriangle className={`w-3.5 h-3.5 ${longTasks.length ? 'text-amber' : 'text-slate'}`} />
          Times the page froze ({longTasks.length})
        </h4>
        <p className="text-xs text-slate mb-2">
          Moments the browser was too busy to respond to clicks or scrolls, even briefly. A few
          short ones are normal; frequent or long ones feel like lag to a real user.
        </p>
        {longTasks.length > 0 ? (
          <div className="space-y-1 max-h-32 overflow-auto">
            {longTasks.slice(-8).map((t, i) => (
              <div
                key={i}
                className="flex justify-between text-xs font-mono px-3 py-1.5 rounded bg-amber/10 border border-amber/20"
              >
                <span>@ {t.start} ms into the page</span>
                <span className="text-amber">froze for {t.duration} ms</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-green">None detected in the current sample — good sign.</p>
        )}
      </div>

      {/* Resources */}
      <div>
        <h4 className="text-sm font-medium mb-1">Network requests ({resources.length})</h4>
        <p className="text-xs text-slate mb-2">
          Images, scripts, and other files this page fetched.{' '}
          {slowResources.length > 0 ? (
            <span className="text-amber">{slowResources.length} took over 300ms — flagged below.</span>
          ) : (
            <span className="text-green">None were notably slow.</span>
          )}
        </p>
        <div className="overflow-auto max-h-56 rounded-lg border border-cyan/10">
          <table className="w-full text-xs">
            <thead className="bg-midnight-lighter sticky top-0">
              <tr className="text-left text-slate">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Duration</th>
                <th className="px-3 py-2 font-medium text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate">
                    No resource entries yet
                  </td>
                </tr>
              )}
              {resources.map((r, i) => {
                const slow = r.duration > 300
                return (
                  <tr key={i} className={`border-t border-cyan/5 hover:bg-cyan/5 ${slow ? 'bg-amber/5' : ''}`}>
                    <td className="px-3 py-1.5 font-mono truncate max-w-[200px]">{r.name}</td>
                    <td className="px-3 py-1.5 text-slate">{r.type}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${slow ? 'text-amber' : ''}`}>
                      {r.duration} ms{slow ? ' ⚠' : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {r.size ? `${Math.round(r.size / 1024)} KB` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate">
        Ratings above are rules of thumb for reading these numbers at a glance, not an official
        performance score.
      </p>
    </div>
  )
}

function MetricCard({ label, sublabel, value, rating, icon, explain }) {
  const style = rating ? RATING_STYLES[rating] : null
  return (
    <div
      className={`p-3 rounded-lg border ${style ? `${style.bg} ${style.border}` : 'bg-midnight-lighter border-cyan/10'}`}
      title={explain}
    >
      <div className="flex items-center gap-1.5 text-xs text-slate mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-lg font-semibold font-mono ${style ? style.color : 'text-cyan'}`}>{value}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate">{sublabel}</span>
        {style && <span className={`text-[10px] font-medium ${style.color}`}>{style.label}</span>}
      </div>
    </div>
  )
}