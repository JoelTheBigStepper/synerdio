import { useState } from 'react'

export default function Landing({ onCreate, onJoin, defaultName }) {
  const [name, setName] = useState(defaultName || '')
  const [joinId, setJoinId] = useState('')
  const [mode, setMode] = useState('create')
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const injectCode = `(function(){var r=prompt('Synerdio room ID');if(!r)return;var s=document.createElement('script');s.src='${origin}/agent.js';s.dataset.room=r;s.onerror=function(){console.error('[synerdio] agent failed to load — deploy on HTTPS?')};document.documentElement.appendChild(s);})();`

  const consoleSnippet = injectCode
  // Bookmarklets need a javascript: URI. Encoding keeps the browser from
  // choking on quotes/semicolons when the link is dragged to the bookmarks
  // bar rather than pasted into the console.
  const bookmarkletHref = 'javascript:' + encodeURIComponent(injectCode)

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
      <div className="w-full max-w-md border-r border-[var(--color-border)] p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="font-mono text-[15px] font-semibold tracking-tight mb-1">
            collaborative live debugger
          </h1>
          <p className="text-[12px] text-[var(--color-text-dim)] leading-relaxed">
            Inject into any page. Share cursors, metrics, and temporary fixes.
            Same room ID on the panel and the agent.
          </p>
        </div>

        <div className="flex gap-0 mb-5 border border-[var(--color-border)]">
          <button
            type="button"
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
            type="button"
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

        <div className="mt-auto pt-10 space-y-3">
          <div className="text-[11px] font-mono text-[var(--color-muted)] uppercase tracking-wider">
            inject agent
          </div>
          <p className="text-[12px] text-[var(--color-text-dim)] leading-relaxed">
            1. Deploy this app to HTTPS (Vercel).<br />
            2. Create a room, copy the room id.<br />
            3. On the target site → drag the bookmarklet below (or paste the console
            snippet) → enter room id.<br />
            4. Green dot on the badge = connected as a peer.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={bookmarkletHref}
              draggable="true"
              onClick={(e) => e.preventDefault()}
              title="Drag this to your bookmarks bar"
              className="h-8 px-3 flex items-center text-[11px] font-mono border border-dashed border-[var(--color-cyan)]/50 text-[var(--color-cyan)] hover:bg-[var(--color-cyan)]/10 transition cursor-grab active:cursor-grabbing select-none"
            >
              ↳ Synerdio Inject
            </a>
            <button
              type="button"
              onClick={copySnippet}
              className="h-8 px-3 text-[11px] font-mono border border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-green)] hover:text-[var(--color-green)] transition"
            >
              {copied ? 'copied' : 'copy console snippet'}
            </button>
          </div>
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
            Drag "↳ Synerdio Inject" to your bookmarks bar. On any site, click it and
            enter the room ID — no console needed. (Some sites' CSP may still block it;
            the console snippet is the fallback.)
          </p>
        </div>
      </div>

      <div className="flex-1 hidden md:flex items-center justify-center p-10">
        <div className="max-w-xs">
          <div className="font-mono text-[12px] text-[var(--color-muted)] mb-3">
            how it works
          </div>
          <ul className="text-[13px] text-[var(--color-text-dim)] space-y-2 leading-relaxed">
            <li>Panel and agent join the same Trystero room.</li>
            <li>Mouse moves and Ctrl/Cmd-clicks sync live.</li>
            <li>Metrics from the target page stream into the panel.</li>
            <li>Patches apply on every peer that has the agent.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}