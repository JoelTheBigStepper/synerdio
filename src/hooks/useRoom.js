import { useState, useEffect, useRef, useCallback } from 'react'
import { joinRoom } from 'trystero'

const APP_ID = 'synerdio-v1'

export function useRoom(roomId, displayName, active) {
  const [peers, setPeers] = useState({})
  const [cursors, setCursors] = useState({})
  const [highlights, setHighlights] = useState({})
  const [metrics, setMetrics] = useState(null)
  const [patches, setPatches] = useState([])
  const [patchRequests, setPatchRequests] = useState([])
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [selfId, setSelfId] = useState(null)
  // Bumping this forces the join effect to re-run, so a person can retry
  // after a failed join without reloading the page.
  const [retryKey, setRetryKey] = useState(0)

  const roomRef = useRef(null)
  const actionsRef = useRef({})
  // Renaming shouldn't tear down and rejoin the WebRTC room, so the join
  // effect below reads the *current* name from this ref instead of
  // depending on `displayName` directly.
  const nameRef = useRef(displayName)
  useEffect(() => {
    nameRef.current = displayName
  }, [displayName])

  // Votes and patch requests travel as separate Trystero actions, which
  // can arrive out of order relative to each other. If a vote shows up
  // before the patch request it belongs to, it's buffered here and
  // merged in once the request arrives, instead of being silently lost.
  const pendingVotesRef = useRef({})

  useEffect(() => {
    if (!active || !roomId) return

    let cancelled = false
    let room

    try {
      room = joinRoom({ appId: APP_ID }, roomId)
    } catch (err) {
      console.error('[synerdio] joinRoom failed', err)
      setConnectionError(err?.message || 'Failed to join room')
      return
    }

    roomRef.current = room

    room.onPeerJoin((peerId) => {
      if (cancelled) return
      setPeers((p) => ({
        ...p,
        [peerId]: { id: peerId, name: p[peerId]?.name || 'peer', role: p[peerId]?.role || 'panel', joinedAt: Date.now() },
      }))
      actionsRef.current.sendPresence?.({ name: nameRef.current, role: 'panel' })
    })

    room.onPeerLeave((peerId) => {
      if (cancelled) return
      setPeers((p) => {
        const next = { ...p }
        delete next[peerId]
        return next
      })
      setCursors((c) => {
        const next = { ...c }
        delete next[peerId]
        return next
      })
      setHighlights((h) => {
        const next = { ...h }
        delete next[peerId]
        return next
      })
      // Drop this peer's vote from any pending requests so stale approvals
      // don't count toward the threshold after they've left.
      setPatchRequests((reqs) =>
        reqs.map((r) => {
          if (!r.votes || !(peerId in r.votes)) return r
          const nextVotes = { ...r.votes }
          delete nextVotes[peerId]
          return { ...r, votes: nextVotes }
        })
      )
    })

    const [sendPresence, getPresence] = room.makeAction('presence')
    const [sendCursor, getCursor] = room.makeAction('cursor')
    const [sendHighlight, getHighlight] = room.makeAction('highlight')
    const [sendMetrics, getMetrics] = room.makeAction('metrics')
    const [sendPatchReq, getPatchReq] = room.makeAction('patchReq')
    const [sendPatchVote, getPatchVote] = room.makeAction('patchVote')
    const [sendPatchApply, getPatchApply] = room.makeAction('patchApply')
    const [sendPatchRevert, getPatchRevert] = room.makeAction('patchRevert')

    actionsRef.current = {
      sendPresence,
      sendCursor,
      sendHighlight,
      sendMetrics,
      sendPatchReq,
      sendPatchVote,
      sendPatchApply,
      sendPatchRevert,
    }

    sendPresence({ name: nameRef.current, role: 'panel' })
    setSelfId(room.selfId || 'local')
    setConnected(true)
    setConnectionError(null)
    pendingVotesRef.current = {}

    getPresence((data, peerId) => {
      if (cancelled) return
      setPeers((p) => ({
        ...p,
        [peerId]: {
          id: peerId,
          name: data?.name || 'peer',
          // Injected agents can't vote (no voting UI exists on the target
          // page), so this is used to exclude them from patch-approval
          // quorums.
          role: data?.role === 'agent' ? 'agent' : 'panel',
          joinedAt: p[peerId]?.joinedAt || Date.now(),
        },
      }))
    })

    getCursor((data, peerId) => {
      if (cancelled || !data) return
      setCursors((c) => ({
        ...c,
        [peerId]: { x: data.x, y: data.y, name: data.name },
      }))
    })

    getHighlight((data, peerId) => {
      if (cancelled) return
      setHighlights((h) => ({
        ...h,
        [peerId]: data?.selector
          ? { selector: data.selector, name: data.name }
          : null,
      }))
    })

    getMetrics((data) => {
      if (cancelled || !data) return
      setMetrics(data)
    })

    getPatchReq((data, peerId) => {
      if (cancelled || !data) return
      setPatchRequests((reqs) => {
        if (reqs.some((r) => r.id === data.id)) return reqs
        const buffered = pendingVotesRef.current[data.id]
        if (buffered) delete pendingVotesRef.current[data.id]
        return [
          ...reqs,
          {
            ...data,
            from: peerId,
            votes: buffered || {},
            id: data.id || crypto.randomUUID(),
          },
        ]
      })
    })

    // Votes are keyed by peerId (not display name) so two peers sharing a
    // name can't overwrite each other's vote.
    getPatchVote((data, peerId) => {
      if (cancelled || !data) return
      setPatchRequests((reqs) => {
        const exists = reqs.some((r) => r.id === data.id)
        if (!exists) {
          // The request hasn't arrived yet — buffer this vote instead of
          // dropping it.
          pendingVotesRef.current[data.id] = {
            ...pendingVotesRef.current[data.id],
            [peerId]: { approve: !!data.approve, name: data.voter },
          }
          return reqs
        }
        return reqs.map((r) =>
          r.id === data.id
            ? { ...r, votes: { ...r.votes, [peerId]: { approve: !!data.approve, name: data.voter } } }
            : r
        )
      })
    })

    getPatchApply((data) => {
      if (cancelled || !data) return
      setPatches((p) => {
        if (p.some((x) => x.id === data.id)) return p
        return [...p, data]
      })
      setPatchRequests((r) => r.filter((x) => x.id !== data.id))
      if (typeof window !== 'undefined' && window.__synerdioApplyPatch) {
        window.__synerdioApplyPatch(data)
      }
    })

    getPatchRevert((data) => {
      if (cancelled || !data?.id) return
      setPatches((p) => p.filter((x) => x.id !== data.id))
      if (typeof window !== 'undefined' && window.__synerdioRevertPatch) {
        window.__synerdioRevertPatch(data.id)
      }
    })

    // Leave promptly on tab close/navigation instead of lingering as a
    // "ghost" peer in everyone else's peer list until the connection
    // times out on its own.
    const handleUnload = () => {
      try {
        room.leave()
      } catch (_) {}
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      try {
        room.leave()
      } catch (_) {}
      roomRef.current = null
      setConnected(false)
      setPeers({})
      setCursors({})
      setHighlights({})
    }
    // Intentionally excludes `displayName` — renaming is handled by the
    // effect below via a presence rebroadcast, not a room rejoin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roomId, retryKey])

  // Rebroadcast presence when the display name changes, without touching
  // the WebRTC connection itself.
  useEffect(() => {
    if (!connected) return
    actionsRef.current.sendPresence?.({ name: displayName, role: 'panel' })
  }, [displayName, connected])

  const reconnect = useCallback(() => {
    setConnectionError(null)
    setRetryKey((k) => k + 1)
  }, [])

  const broadcastCursor = useCallback(
    (x, y) => {
      actionsRef.current.sendCursor?.({ x, y, name: displayName })
    },
    [displayName]
  )

  const broadcastHighlight = useCallback(
    (selector) => {
      actionsRef.current.sendHighlight?.({ selector, name: displayName })
    },
    [displayName]
  )

  const broadcastMetrics = useCallback((data) => {
    actionsRef.current.sendMetrics?.(data)
  }, [])

  const requestPatch = useCallback(
    (patch) => {
      const id = crypto.randomUUID()
      const payload = {
        ...patch,
        id,
        requester: displayName,
        ts: Date.now(),
      }
      actionsRef.current.sendPatchReq?.(payload)
      // Proposing a patch counts as your own approval of it — you were
      // about to click "approve" on it anyway, and requiring a separate
      // click just to vote for your own proposal was confusing.
      actionsRef.current.sendPatchVote?.({ id, voter: displayName, approve: true })
      setPatchRequests((r) => [
        ...r,
        {
          ...payload,
          from: 'self',
          votes: { [selfId || 'self']: { approve: true, name: displayName } },
        },
      ])
      return id
    },
    [displayName, selfId]
  )

  const votePatch = useCallback(
    (id, approve) => {
      actionsRef.current.sendPatchVote?.({
        id,
        voter: displayName,
        approve,
      })
      // Trystero doesn't echo your own sends back through the `get`
      // callback, so record the local vote immediately or it never shows.
      setPatchRequests((reqs) =>
        reqs.map((r) =>
          r.id === id
            ? {
                ...r,
                votes: {
                  ...r.votes,
                  [selfId || 'self']: { approve: !!approve, name: displayName },
                },
              }
            : r
        )
      )
    },
    [displayName, selfId]
  )

  const applyPatch = useCallback((patch) => {
    actionsRef.current.sendPatchApply?.(patch)
    setPatches((p) => {
      if (p.some((x) => x.id === patch.id)) return p
      return [...p, patch]
    })
    setPatchRequests((r) => r.filter((x) => x.id !== patch.id))
    if (typeof window !== 'undefined' && window.__synerdioApplyPatch) {
      window.__synerdioApplyPatch(patch)
    }
  }, [])

  const revertPatch = useCallback((id) => {
    actionsRef.current.sendPatchRevert?.({ id })
    setPatches((p) => p.filter((x) => x.id !== id))
    if (typeof window !== 'undefined' && window.__synerdioRevertPatch) {
      window.__synerdioRevertPatch(id)
    }
  }, [])

  const leave = useCallback(() => {
    roomRef.current?.leave?.()
  }, [])

  const peerCount = Object.keys(peers).length + 1
  // Injected agents can't vote — only panel instances (including you)
  // can, so the patch-approval quorum is based on this, not peerCount.
  const voterCount = Object.values(peers).filter((p) => p.role !== 'agent').length + 1

  return {
    connected,
    connectionError,
    reconnect,
    selfId,
    peers,
    peerCount,
    voterCount,
    cursors,
    highlights,
    metrics,
    patches,
    patchRequests,
    broadcastCursor,
    broadcastHighlight,
    broadcastMetrics,
    requestPatch,
    votePatch,
    applyPatch,
    revertPatch,
    leave,
  }
}