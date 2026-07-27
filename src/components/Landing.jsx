import { useState } from 'react'

export default function Landing({ onCreate, onJoin, defaultName }) {
  const [name, setName] = useState(defaultName || '')
  const [joinId, setJoinId] = useState('')
  const [mode, setMode] = useState('create') // create | join
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const consoleSnippet = `(()=>{const r=prompt('Room ID');if(!r)return;const s=document.createElement('script');s.src='${origin}/agent.js';s.dataset.room=r;s.onerror=()=>console.error('[synerdio] agent failed to load');document.documentElement.appendChild(s)})();`

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(consoleSnippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = consoleSnippet
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    if (mode === 'create') onCreate(name.trim())
    else if (joinId.trim()) onJoin(joinId.trim(), name.trim())
  }

  return (
    <div className="h-full flex">
      {/* Left — entry */}
      <div className="w-full max-w-md border-r border-[var(--color-border)] p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="font-mono text-[15px] font-semibold tracking-tight mb-1">
            collaborative live debugger
          </h1>
          <p className="text-[12px] text-[var(--color-text-dim)] leading-relaxed">
            Inject into any page. Share cursors, metrics, and temporary fixes with the room.
            No accounts. No server of your own.
          </p>
        </div>

        <div className="flex gap-0 mb-5 border border-[var(--color-border)]">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 h-8 text-[12px] font-mono transition ${
              mode === 'create'
                ? 'bg-[var(--color-cyan)] text-[var(--color-midnight)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            }`}
          >
            create
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 h-8 text-[12px] font-mono border-l border-[var(--color-border)] transition ${
              mode === 'join'
                ? 'bg-[var(--color-cyan)] text-[var(--color-midnight)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            }`}
          >
            join
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-mono text-[var(--color-muted)] uppercase tracking-wider">
              name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full h-9 px-3 bg-[var(--color-elevated)] border border-[var(--color-border)] text-[13px] font-mono outline-none focus:border-[var(--color-cyan)]"
              placeholder="alex"
              required
            />
          </label>

          {mode === 'join' && (
            <label className="block">
              <span className="text-[11px] font-mono text-[var(--color-muted)] uppercase tracking-wider">
                room id
              </span>
              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="mt-1 w-full h-9 px-3 bg-[var(--color-elevated)] border border-[var(--color-border)] text-[13px] font-mono outline-none focus:border-[var(--color-cyan)]"
                placeholder="a1b2c3d4"
                required
              />
            </label>
          )}

          <button
            type="submit"
            className="w-full h-9 mt-2 bg-[var(--color-cyan)] text-[var(--color-midnight)] text-[12px] font-mono font-semibold hover:opacity-90 transition"
          >
            {mode === 'create' ? 'create room →' : 'join room →'}
          </button>
        </form>

        <div className="mt-auto pt-10">
          <div className="text-[11px] font-mono text-[var(--color-muted)] uppercase tracking-wider mb-2">
            inject agent
          </div>
          <p className="text-[12px] text-[var(--color-text-dim)] mb-3 leading-relaxed">
            Open target page → DevTools Console → paste snippet → enter room id.
            Localhost cannot inject into most HTTPS sites (mixed content). Deploy to Vercel for full reach.
          </p>
          <button
            onClick={copySnippet}
            className="h-8 px-3 text-[11px] font-mono border border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-green)] hover:text-[var(--color-green)] transition"
          >
            {copied ? 'copied' : 'copy console snippet'}
          </button>
        </div>
      </div>

      {/* Right — quiet status / empty state */}
      <div className="flex-1 hidden md:flex items-center justify-center p-10">
        <div className="max-w-xs text-center">
          <div className="font-mono text-[12px] text-[var(--color-muted)] mb-3">
            session idle
          </div>
          <p className="text-[13px] text-[var(--color-text-dim)] leading-relaxed">
            Create or join a room, then inject the agent into the page under inspection.
            Ctrl/Cmd-click elements to highlight for the room.
          </p>
        </div>
      </div>
    </div>
  )
}