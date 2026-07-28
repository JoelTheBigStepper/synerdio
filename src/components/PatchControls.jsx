import { useState } from 'react'
import { Wand2, Check, X, RotateCcw, Plus, ShieldCheck, AlertOctagon } from 'lucide-react'

export default function PatchControls({
  patches = [],
  requests = [],
  onRequest,
  onVote,
  onApply,
  onRevert,
  selfName,
  peerCount = 1,
}) {
  const [css, setCss] = useState('')
  const [js, setJs] = useState('')
  const [desc, setDesc] = useState('')
  const [showForm, setShowForm] = useState(false)
  // Two-step confirmation before running a JS patch on every peer's page.
  const [confirmId, setConfirmId] = useState(null)

  // Require a majority of everyone currently in the room before a patch
  // (which can include arbitrary JS via `new Function`) is allowed to apply.
  const requiredApprovals = Math.max(1, Math.ceil(peerCount / 2))

  const tally = (r) => {
    const votes = Object.values(r.votes || {})
    const approve = votes.filter((v) => v.approve).length
    const reject = votes.filter((v) => !v.approve).length
    return { approve, reject }
  }

  const handlePropose = (e) => {
    e.preventDefault()
    if (!css.trim() && !js.trim()) return
    onRequest({
      css: css.trim() || null,
      js: js.trim() || null,
      description: desc.trim() || 'Untitled patch',
      requester: selfName,
    })
    setCss('')
    setJs('')
    setDesc('')
    setShowForm(false)
  }

  const handleApplyClick = (r) => {
    if (r.js && confirmId !== r.id) {
      setConfirmId(r.id)
      return
    }
    setConfirmId(null)
    onApply(r)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-cyan" />
          Temporary Patches
        </h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-cyan/10 text-cyan border border-cyan/30 hover:bg-cyan/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Propose
        </button>
      </div>

      <p className="text-sm text-slate">
        Propose a temporary CSS or JS change. A majority of the room ({requiredApprovals}
        {' '}of {peerCount}) must approve before it can be applied for everyone (and can be
        reverted).
      </p>

      {showForm && (
        <form onSubmit={handlePropose} className="p-4 rounded-xl bg-midnight-lighter border border-cyan/20 space-y-3">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Short description (e.g. Fix button reflow)"
            className="w-full px-3 py-2 rounded-lg bg-midnight border border-cyan/20 outline-none focus:border-cyan text-sm"
          />
          <textarea
            value={css}
            onChange={(e) => setCss(e.target.value)}
            placeholder="CSS (e.g. .btn { contain: layout; })"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-midnight border border-cyan/20 outline-none focus:border-cyan text-sm font-mono"
          />
          <textarea
            value={js}
            onChange={(e) => setJs(e.target.value)}
            placeholder="JS (optional, runs once in page context)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-midnight border border-cyan/20 outline-none focus:border-cyan text-sm font-mono"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan text-midnight text-sm font-semibold hover:bg-cyan-dim transition"
            >
              Send for votes
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Pending requests */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-amber">Pending Approvals</h4>
          {requests.map((r) => {
            const { approve, reject } = tally(r)
            const canApply = approve >= requiredApprovals
            const awaitingConfirm = confirmId === r.id
            return (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-amber/5 border border-amber/20 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{r.description}</div>
                    <div className="text-xs text-slate">by {r.requester || r.from}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onVote(r.id, true)}
                      className="p-1.5 rounded bg-green/20 text-green hover:bg-green/30"
                      title="Approve"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onVote(r.id, false)}
                      className="p-1.5 rounded bg-red/20 text-red hover:bg-red/30"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => canApply && handleApplyClick(r)}
                      disabled={!canApply}
                      title={
                        !canApply
                          ? `Needs ${requiredApprovals - approve} more approval${
                              requiredApprovals - approve === 1 ? '' : 's'
                            }`
                          : awaitingConfirm
                          ? 'Click again to confirm running this JS on every peer'
                          : 'Apply now'
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
                        !canApply
                          ? 'bg-midnight-lighter text-slate cursor-not-allowed opacity-60'
                          : awaitingConfirm
                          ? 'bg-red/20 text-red border border-red/40 hover:bg-red/30'
                          : 'bg-cyan/20 text-cyan hover:bg-cyan/30'
                      }`}
                    >
                      {awaitingConfirm && <AlertOctagon className="w-3 h-3" />}
                      {awaitingConfirm ? 'Confirm — runs JS' : 'Apply now'}
                    </button>
                    {awaitingConfirm && (
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-slate hover:text-white px-1"
                      >
                        cancel
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="text-green">{approve} approve</span>
                  <span>·</span>
                  <span className="text-red">{reject} reject</span>
                  <span>·</span>
                  <span>{requiredApprovals} needed</span>
                  {r.js && (
                    <>
                      <span>·</span>
                      <span className="text-amber">includes JS</span>
                    </>
                  )}
                </div>
                {r.css && (
                  <pre className="text-xs font-mono bg-midnight p-2 rounded overflow-auto max-h-20 text-green">
                    {r.css}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Applied */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-green">Applied ({patches.length})</h4>
        {patches.length === 0 && (
          <p className="text-sm text-slate">No patches applied yet.</p>
        )}
        {patches.map((p) => (
          <div
            key={p.id}
            className="p-4 rounded-xl bg-green/5 border border-green/20 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-sm">{p.description}</div>
              <div className="text-xs text-slate">by {p.requester}</div>
              {p.css && (
                <pre className="mt-2 text-xs font-mono bg-midnight p-2 rounded overflow-auto max-h-16 text-green">
                  {p.css}
                </pre>
              )}
            </div>
            <button
              onClick={() => onRevert(p.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Revert
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}