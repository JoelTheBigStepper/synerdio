import { useState, useEffect, useRef, useCallback } from 'react'
import { joinRoom } from 'trystero'

const APP_ID = 'synerdio-v1'

/**
 * Core collaboration hook using Trystero (serverless WebRTC).
 * Handles presence, cursors, highlighters, metrics sync, and permission-based patches.
 */
export function useRoom(roomId, displayName, active) {
  const [peers, setPeers] = useState({})
  const [cursors, setCursors] = useState({})
  const [highlights, setHighlights] = useState({})
  const [metrics, setMetrics] = useState(null)
  const [patches, setPatches] = useState([])
  const [patchRequests, setPatchRequests] = useState([])
  const [connected, setConnected] = useState(false)
  const [selfId, setSelfId] = useState(null)

  const roomRef = useRef(null)
  const actionsRef = useRef({})

  useEffect(() => {
    if (!active || !roomId) return

    let cancelled = false

    const room = joinRoom({ appId: APP_ID }, roomId)
    roomRef.current = room

    // Presence
    room.onPeerJoin((peerId) => {
      if (cancelled) return
      setPeers((p) => ({
        ...p,
        [peerId]: { id: peerId, name: 'Peer', joinedAt: Date.now() },
      }))
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
    })

    // Typed actions
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

    // Announce self
    sendPresence({ name: displayName })
    setSelfId(room.selfId || 'local')
    setConnected(true)

    getPresence((data, peerId) => {
      setPeers((p) => ({
        ...p,
        [peerId]: { id: peerId, name: data.name || 'Peer', joinedAt: Date.now() },
      }))
    })

    getCursor((data, peerId) => {
      setCursors((c) => ({
        ...c,
        [peerId]: { x: data.x, y: data.y, name: data.name },
      }))
    })

    getHighlight((data, peerId) => {
      setHighlights((h) => ({
        ...h,
        [peerId]: data.selector
          ? { selector: data.selector, name: data.name }
          : null,
      }))
    })

    getMetrics((data) => {
      setMetrics(data)
    })

    getPatchReq((data, peerId) => {
      setPatchRequests((reqs) => [
        ...reqs,
        { ...data, from: peerId, votes: {}, id: data.id || crypto.randomUUID() },
      ])
    })

    getPatchVote((data) => {
      setPatchRequests((reqs) =>
        reqs.map((r) =>
          r.id === data.id
            ? { ...r, votes: { ...r.votes, [data.voter]: data.approve } }
            : r
        )
      )
    })

    getPatchApply((data) => {
      setPatches((p) => [...p, data])
      // Apply in this browser if we are on a target page with agent
      if (window.__synerdioApplyPatch) {
        window.__synerdioApplyPatch(data)
      }
    })

    getPatchRevert((data) => {
      setPatches((p) => p.filter((x) => x.id !== data.id))
      if (window.__synerdioRevertPatch) {
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

  const broadcastCursor = useCallback((x, y) => {
    actionsRef.current.sendCursor?.({ x, y, name: displayName })
  }, [displayName])

  const broadcastHighlight = useCallback((selector) => {
    actionsRef.current.sendHighlight?.({ selector, name: displayName })
  }, [displayName])

  const broadcastMetrics = useCallback((data) => {
    actionsRef.current.sendMetrics?.(data)
  }, [])

  const requestPatch = useCallback((patch) => {
    const id = crypto.randomUUID()
    const payload = { ...patch, id, requester: displayName, ts: Date.now() }
    actionsRef.current.sendPatchReq?.(payload)
    setPatchRequests((r) => [...r, { ...payload, from: 'self', votes: {} }])
    return id
  }, [displayName])

  const votePatch = useCallback((id, approve) => {
    actionsRef.current.sendPatchVote?.({ id, voter: displayName, approve })
  }, [displayName])

  const applyPatch = useCallback((patch) => {
    actionsRef.current.sendPatchApply?.(patch)
    setPatches((p) => [...p, patch])
    setPatchRequests((r) => r.filter((x) => x.id !== patch.id))
  }, [])

  const revertPatch = useCallback((id) => {
    actionsRef.current.sendPatchRevert?.({ id })
    setPatches((p) => p.filter((x) => x.id !== id))
  }, [])

  const leave = useCallback(() => {
    roomRef.current?.leave?.()
  }, [])

  return {
    connected,
    selfId,
    peers,
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
