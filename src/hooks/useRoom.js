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

  const roomRef = useRef(null)
  const actionsRef = useRef({})

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
        [peerId]: { id: peerId, name: p[peerId]?.name || 'peer', joinedAt: Date.now() },
      }))
      actionsRef.current.sendPresence?.({ name: displayName })
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

    sendPresence({ name: displayName })
    setSelfId(room.selfId || 'local')
    setConnected(true)
    setConnectionError(null)

    getPresence((data, peerId) => {
      if (cancelled) return
      setPeers((p) => ({
        ...p,
        [peerId]: {
          id: peerId,
          name: data?.name || 'peer',
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
        return [
          ...reqs,
          {
            ...data,
            from: peerId,
            votes: {},
            id: data.id || crypto.randomUUID(),
          },
        ]
      })
    })

    // Votes are keyed by peerId (not display name) so two peers sharing a
    // name can't overwrite each other's vote.
    getPatchVote((data, peerId) => {
      if (cancelled || !data) return
      setPatchRequests((reqs) =>
        reqs.map((r) =>
          r.id === data.id
            ? { ...r, votes: { ...r.votes, [peerId]: { approve: !!data.approve, name: data.voter } } }
            : r
        )
      )
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

    return () => {
      cancelled = true
      try {
        room.leave()
      } catch (_) {}
      roomRef.current = null
      setConnected(false)
      setPeers({})
      setCursors({})
      setHighlights({})
    }
  }, [active, roomId, displayName])

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
      setPatchRequests((r) => [...r, { ...payload, from: 'self', votes: {} }])
      return id
    },
    [displayName]
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

  return {
    connected,
    connectionError,
    selfId,
    peers,
    peerCount,
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