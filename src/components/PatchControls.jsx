import { useState, useMemo } from 'react'
import {
  Wand2,
  Check,
  X,
  RotateCcw,
  Plus,
  ShieldCheck,
  AlertOctagon,
  Crosshair,
  EyeOff,
  Sparkles,
  Type,
  Move,
  Palette,
  Code2,
} from 'lucide-react'

export default function PatchControls({
  patches = [],
  requests = [],
  onRequest,
  onVote,
  onApply,
  onRevert,
  selfName,
  peerCount = 1,
  highlights = {},
}) {
  const [css, setCss] = useState('')
  const [js, setJs] = useState('')
  const [desc, setDesc] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [targetSelector, setTargetSelector] = useState('')
  const [manualSelector, setManualSelector] = useState('')
  const [bgColor, setBgColor] = useState('#00F0FF')
  const [textColor, setTextColor] = useState('#E2E8F0')
  // Two-step confirmation before running a JS patch on every peer's page.
  const [confirmId, setConfirmId] = useState(null)

  // Require a majority of everyone currently in the room before a patch
  // (which can include arbitrary JS via `new Function`) is allowed to apply.
  const requiredApprovals = Math.max(1, Math.ceil(peerCount / 2))

  // Elements someone in the room has Ctrl/Cmd-clicked recently — these are
  // real, valid selectors, so picking one here beats typing a selector by
  // hand and hoping it matches something.
  const activeHighlights = useMemo(
    () =>
      Object.entries(highlights || {})
        .filter(([, h]) => h?.selector)
        .map(([peerId, h]) => ({ peerId, ...h })),
    [highlights]
  )

  const tally = (r) => {
    const votes = Object.values(r.votes || {})
    const approve = votes.filter((v) => v.approve).length
    const reject = votes.filter((v) => !v.approve).length
    return { approve, reject }
  }

  const resetForm = () => {
    setCss('')
    setJs('')
    setDesc('')
    setTargetSelector('')
    setManualSelector('')
    setAdvanced(false)
    setShowForm(false)
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
    resetForm()
  }

  const handleApplyClick = (r) => {
    if (r.js && confirmId !== r.id) {
      setConfirmId(r.id)
      return
    }
    setConfirmId(null)
    onApply(r)
  }

  const effectiveTarget = targetSelector || manualSelector.trim()

  // Quick fixes write the CSS for you based on the selected target, so
  // proposing a patch doesn't require knowing CSS at all — you can still
  // see and edit the generated rule before sending it for votes.
  const quickActions = [
    {
      icon: EyeOff,
      label: 'Hide it',
      run: () =>
        applyQuick(`${effectiveTarget} { display: none !important; }`, `Hide ${effectiveTarget}`),
    },
    {
      icon: Sparkles,
      label: 'Draw attention',
      run: () =>
        applyQuick(
          `${effectiveTarget} { outline: 3px solid #F59E0B !important; outline-offset: 2px !important; }`,
          `Highlight ${effectiveTarget}`
        ),
    },
    {
      icon: Type,
      label: 'Bigger text',
      run: () =>
        applyQuick(`${effectiveTarget} { font-size: 1.25em !important; }`, `Increase text size on ${effectiveTarget}`),
    },
    {
      icon: Type,
      label: 'Smaller text',
      run: () =>
        applyQuick(`${effectiveTarget} { font-size: 0.85em !important; }`, `Decrease text size on ${effectiveTarget}`),
    },
    {
      icon: Move,
      label: 'Add spacing',
      run: () =>
        applyQuick(`${effectiveTarget} { margin: 16px !important; }`, `Add spacing around ${effectiveTarget}`),
    },
  ]

  function applyQuick(cssRule, label) {
    setCss(cssRule)
    setDesc(label)
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
        Ctrl/Cmd-click an element on the target page, pick it below, then choose a fix — no
        code required. A majority of the room ({requiredApprovals} of {peerCount}) must
        approve before it applies for everyone.
      </p>

      {showForm && (
        <form onSubmit={handlePropose} className="p-4 rounded-xl bg-midnight-lighter border border-cyan/20 space-y-4">
          {/* Step 1: pick a target */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              1. Target element
            </div>
            {activeHighlights.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeHighlights.map((h) => (
                  <button
                    key={h.peerId}
                    type="button"
                    onClick={() => {
                      setTargetSelector(h.selector)
                      setManualSelector('')
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition truncate max-w-[220px] ${
                      targetSelector === h.selector
                        ? 'bg-cyan/20 border-cyan text-cyan'
                        : 'bg-midnight border-cyan/20 text-slate hover:border-cyan/40'
                    }`}
                    title={h.selector}
                  >
                    {h.name ? `${h.name}: ` : ''}
                    {h.selector}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate">
                No element highlighted yet — Ctrl/Cmd-click something on the target page and
                it'll show up here.
              </p>
            )}
            <input
              value={manualSelector}
              onChange={(e) => {
                setManualSelector(e.target.value)
                setTargetSelector('')
              }}
              placeholder="…or type a CSS selector manually (e.g. .header button)"
              className="w-full px-3 py-1.5 rounded-lg bg-midnight border border-cyan/20 outline-none focus:border-cyan text-xs font-mono"
            />
          </div>

          {/* Step 2: quick fixes (shown once a target is set) */}
          {effectiveTarget && !advanced && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate">2. Choose a fix</div>
              <div className="flex flex-wrap gap-1.5">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.run}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-midnight border border-cyan/20 text-text hover:border-cyan/40 transition"
                  >
                    <a.icon className="w-3.5 h-3.5" />
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-7 h-7 rounded border border-cyan/20 bg-midnight cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyQuick(
                        `${effectiveTarget} { background-color: ${bgColor} !important; }`,
                        `Change background color on ${effectiveTarget}`
                      )
                    }
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-midnight border border-cyan/20 hover:border-cyan/40 transition"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Set background
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-7 h-7 rounded border border-cyan/20 bg-midnight cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyQuick(
                        `${effectiveTarget} { color: ${textColor} !important; }`,
                        `Change text color on ${effectiveTarget}`
                      )
                    }
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-midnight border border-cyan/20 hover:border-cyan/40 transition"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Set text color
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Description (auto-filled by quick fixes, editable) */}
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Short description (e.g. Fix button reflow)"
            className="w-full px-3 py-2 rounded-lg bg-midnight border border-cyan/20 outline-none focus:border-cyan text-sm"
          />

          {/* Preview of what will actually run, always visible before sending */}
          {css && (
            <div>
              <div className="text-xs text-slate mb-1">Will apply:</div>
              <pre className="text-xs font-mono bg-midnight p-2 rounded overflow-auto max-h-24 text-green border border-green/20">
                {css}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="flex items-center gap-1.5 text-xs text-slate hover:text-cyan transition"
          >
            <Code2 className="w-3.5 h-3.5" />
            {advanced ? 'Hide raw CSS/JS' : 'Write CSS/JS myself instead'}
          </button>

          {advanced && (
            <div className="space-y-2">
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
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!css.trim() && !js.trim()}
              className="px-4 py-2 rounded-lg bg-cyan text-midnight text-sm font-semibold hover:bg-cyan-dim transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send for votes
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-slate hover:text-white">
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
              <div key={r.id} className="p-4 rounded-xl bg-amber/5 border border-amber/20 space-y-2">
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
                      <button onClick={() => setConfirmId(null)} className="text-xs text-slate hover:text-white px-1">
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
        {patches.length === 0 && <p className="text-sm text-slate">No patches applied yet.</p>}
        {patches.map((p) => (
          <div key={p.id} className="p-4 rounded-xl bg-green/5 border border-green/20 flex items-start justify-between gap-3">
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