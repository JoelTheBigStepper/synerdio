import { Users, MousePointer2, Highlighter } from 'lucide-react'

export default function PeerList({ peers, selfName, cursors, highlights }) {
  const list = Object.values(peers || {})

  return (
    <div className="space-y-6">
      <h3 className="font-semibold flex items-center gap-2">
        <Users className="w-4 h-4 text-cyan" />
        Room Presence
      </h3>

      <div className="space-y-2">
        {/* Self */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan/10 border border-cyan/20">
          <div className="w-8 h-8 rounded-full bg-cyan/30 flex items-center justify-center text-sm font-bold text-cyan">
            {selfName?.[0]?.toUpperCase() || 'Y'}
          </div>
          <div className="flex-1">
            <div className="font-medium">{selfName} <span className="text-xs text-cyan">(you)</span></div>
          </div>
        </div>

        {list.length === 0 && (
          <p className="text-sm text-slate py-4 text-center">
            Waiting for peers to join… Share the room ID or use the bookmarklet.
          </p>
        )}

        {list.map((p) => {
          const hasCursor = cursors?.[p.id]
          const hasHighlight = highlights?.[p.id]?.selector
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-midnight-lighter border border-cyan/10"
            >
              <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-sm font-bold text-green">
                {(p.name || 'P')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name || 'Peer'}</div>
                <div className="text-xs text-slate font-mono truncate">{p.id.slice(0, 12)}</div>
              </div>
              <div className="flex gap-2">
                {hasCursor && (
                  <span title="Cursor active" className="text-cyan">
                    <MousePointer2 className="w-4 h-4" />
                  </span>
                )}
                {hasHighlight && (
                  <span title="Highlighting element" className="text-amber">
                    <Highlighter className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
