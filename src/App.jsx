import { useState, useEffect } from 'react'
import { useTheme } from './hooks/useTheme'
import { useRoom } from './hooks/useRoom'
import Landing from './components/Landing'
import Panel from './components/Panel'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [mode, setMode] = useState('landing')
  const [roomId, setRoomId] = useState(null)
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('synerdio-name') || `dev-${Math.floor(Math.random() * 9000 + 1000)}`
  })
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(displayName)

  const room = useRoom(roomId, displayName, mode === 'room')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('room')
    if (r) {
      setRoomId(r)
      setMode('room')
    }
  }, [])

  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  const handleCreateRoom = (name) => {
    const id = crypto.randomUUID().slice(0, 8)
    localStorage.setItem('synerdio-name', name)
    setDisplayName(name)
    setRoomId(id)
    setMode('room')
    const url = new URL(window.location)
    url.searchParams.set('room', id)
    window.history.pushState({}, '', url)
  }

  const handleJoinRoom = (id, name) => {
    localStorage.setItem('synerdio-name', name)
    setDisplayName(name)
    setRoomId(id.trim())
    setMode('room')
    const url = new URL(window.location)
    url.searchParams.set('room', id.trim())
    window.history.pushState({}, '', url)
  }

  const handleLeave = () => {
    room.leave?.()
    setRoomId(null)
    setMode('landing')
    const url = new URL(window.location)
    url.searchParams.delete('room')
    window.history.pushState({}, '', url)
  }

  // Renaming just updates state — useRoom rebroadcasts presence to peers
  // already in the room instead of leaving and rejoining.
  const commitName = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== displayName) {
      localStorage.setItem('synerdio-name', trimmed)
      setDisplayName(trimmed)
    } else {
      setNameDraft(displayName)
    }
    setEditingName(false)
  }

  const cancelNameEdit = () => {
    setNameDraft(displayName)
    setEditingName(false)
  }

  return (
    <div className={`min-h-full flex flex-col ${theme}`}>
      <header className="h-10 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center px-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[13px] font-semibold tracking-tight text-[var(--color-cyan)]">
            synerdio
          </span>
          {mode === 'room' && roomId && (
            <>
              <span className="text-[var(--color-muted)]">/</span>
              <span className="font-mono text-[12px] text-[var(--color-text-dim)] truncate">
                {roomId}
              </span>
              <span className="text-[var(--color-muted)]">·</span>
              {editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName()
                    if (e.key === 'Escape') cancelNameEdit()
                  }}
                  className="h-5 w-24 px-1 bg-[var(--color-elevated)] border border-[var(--color-cyan)] text-[11px] font-mono outline-none text-[var(--color-text)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  title="Click to rename"
                  className="font-mono text-[12px] text-[var(--color-cyan)] hover:underline truncate max-w-[120px]"
                >
                  {displayName}
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {mode === 'room' && (
            <button
              onClick={handleLeave}
              className="h-6 px-2 text-[11px] font-mono border border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-amber)] hover:text-[var(--color-amber)] transition"
            >
              leave
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="h-6 w-6 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        {mode === 'landing' ? (
          <Landing
            onCreate={handleCreateRoom}
            onJoin={handleJoinRoom}
            defaultName={displayName}
          />
        ) : (
          <Panel roomId={roomId} displayName={displayName} room={room} />
        )}
      </main>
    </div>
  )
}