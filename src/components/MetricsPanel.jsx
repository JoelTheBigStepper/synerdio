import { Activity, Clock, HardDrive, AlertTriangle } from 'lucide-react'

function safeHostname(url) {
  if (!url) return '—'
  try {
    return new URL(url).hostname
  } catch {
    return '—'
  }
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

      {/* Timing cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="TTFB"
          value={timing?.ttfb != null ? `${timing.ttfb} ms` : '—'}
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="DOM Content"
          value={timing?.domContentLoaded != null ? `${timing.domContentLoaded} ms` : '—'}
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Load"
          value={timing?.load != null ? `${timing.load} ms` : '—'}
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="JS Heap"
          value={memory ? `${memory.used} / ${memory.total} MB` : '—'}
          icon={<HardDrive className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Long tasks */}
      {longTasks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-amber mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Long Tasks ({longTasks.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-auto">
            {longTasks.slice(-8).map((t, i) => (
              <div
                key={i}
                className="flex justify-between text-xs font-mono px-3 py-1.5 rounded bg-amber/10 border border-amber/20"
              >
                <span>@ {t.start} ms</span>
                <span className="text-amber">{t.duration} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources */}
      <div>
        <h4 className="text-sm font-medium mb-2">Recent Resources</h4>
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
              {resources.map((r, i) => (
                <tr key={i} className="border-t border-cyan/5 hover:bg-cyan/5">
                  <td className="px-3 py-1.5 font-mono truncate max-w-[200px]">{r.name}</td>
                  <td className="px-3 py-1.5 text-slate">{r.type}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.duration} ms</td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {r.size ? `${Math.round(r.size / 1024)} KB` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="p-3 rounded-lg bg-midnight-lighter border border-cyan/10">
      <div className="flex items-center gap-1.5 text-xs text-slate mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold font-mono text-cyan">{value}</div>
    </div>
  )
}