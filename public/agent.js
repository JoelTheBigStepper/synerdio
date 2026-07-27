/**
 * Synerdio Agent — injected into any target page.
 * Collects metrics, shows remote cursors/highlighters, applies shared patches.
 * Built as IIFE via esbuild for bookmarklet / script tag use.
 */
(function () {
  if (window.__synerdioAgent) {
    console.warn('[Synerdio] Agent already injected')
    return
  }
  window.__synerdioAgent = true

  const ROOM =
    document.currentScript?.dataset?.room ||
    new URLSearchParams(location.search).get('synerdio') ||
    prompt('Synerdio Room ID') ||
    ''

  if (!ROOM) {
    console.warn('[Synerdio] No room ID provided')
    return
  }

  console.log('%c[Synerdio] Agent starting — room', 'color:#00F0FF;font-weight:bold', ROOM)

  // ---------- Minimal Trystero-like signaling via BroadcastChannel fallback + WebRTC attempt ----------
  // For maximum reliability in bookmarklet context we use a lightweight custom layer
  // that still works when the full Trystero bundle is loaded from the host origin.

  const ORIGIN = document.currentScript?.src
    ? new URL(document.currentScript.src).origin
    : 'https://synerdio.vercel.app'

  // Load the full agent runtime from the hosted app (keeps bookmarklet tiny)
  // In production the public/agent.js is the bundled version of this file + trystero.
  // For this MVP we implement core features inline so it works standalone.

  const peers = new Map()
  const cursors = new Map()
  let selfName = localStorage.getItem('synerdio-name') || `Guest-${Math.floor(Math.random() * 999)}`

  // ---------- Cursor broadcasting ----------
  let lastCursorSend = 0
  document.addEventListener('mousemove', (e) => {
    const now = performance.now()
    if (now - lastCursorSend < 40) return
    lastCursorSend = now
    broadcast({ type: 'cursor', x: e.clientX, y: e.clientY, name: selfName })
  })

  // ---------- Element highlight on click (Ctrl/Cmd + click) ----------
  document.addEventListener(
    'click',
    (e) => {
      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      e.stopPropagation()
      const el = e.target
      const selector = uniqueSelector(el)
      clearLocalHighlight()
      el.classList.add('synerdio-highlight')
      broadcast({ type: 'highlight', selector, name: selfName })
    },
    true
  )

  function uniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`
    const parts = []
    let cur = el
    while (cur && cur !== document.body && parts.length < 5) {
      let part = cur.tagName.toLowerCase()
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\s+/).slice(0, 2).map(CSS.escape).join('.')
        if (cls) part += '.' + cls
      }
      parts.unshift(part)
      cur = cur.parentElement
    }
    return parts.join(' > ')
  }

  function clearLocalHighlight() {
    document.querySelectorAll('.synerdio-highlight').forEach((n) => n.classList.remove('synerdio-highlight'))
  }

  // ---------- Metrics ----------
  function collectMetrics() {
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource').slice(-25)
    return {
      type: 'metrics',
      ts: Date.now(),
      url: location.href,
      timing: nav
        ? {
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            load: Math.round(nav.loadEventEnd - nav.startTime),
          }
        : null,
      resources: resources.map((r) => ({
        name: (r.name.split('/').pop() || r.name).slice(0, 48),
        duration: Math.round(r.duration),
        size: r.transferSize || 0,
        type: r.initiatorType,
      })),
      memory: performance.memory
        ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1048576),
            total: Math.round(performance.memory.totalJSHeapSize / 1048576),
          }
        : null,
      longTasks: window.__synerdioLongTasks || [],
    }
  }

  // Long task observer
  try {
    const obs = new PerformanceObserver((list) => {
      if (!window.__synerdioLongTasks) window.__synerdioLongTasks = []
      list.getEntries().forEach((e) => {
        window.__synerdioLongTasks.push({
          duration: Math.round(e.duration),
          start: Math.round(e.startTime),
        })
      })
      window.__synerdioLongTasks = window.__synerdioLongTasks.slice(-20)
    })
    obs.observe({ type: 'longtask', buffered: true })
  } catch (_) {}

  setInterval(() => {
    broadcast(collectMetrics())
  }, 3500)

  // ---------- Patches ----------
  const appliedStyles = new Map()

  window.__synerdioApplyPatch = function (patch) {
    if (patch.css) {
      const style = document.createElement('style')
      style.dataset.synerdioPatch = patch.id
      style.textContent = patch.css
      document.head.appendChild(style)
      appliedStyles.set(patch.id, style)
    }
    if (patch.js) {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(patch.js)
        fn()
      } catch (err) {
        console.error('[Synerdio] Patch JS error', err)
      }
    }
    console.log('%c[Synerdio] Patch applied', 'color:#10B981', patch.description)
  }

  window.__synerdioRevertPatch = function (id) {
    const style = appliedStyles.get(id)
    if (style) {
      style.remove()
      appliedStyles.delete(id)
    }
  }

  // ---------- Simple multi-tab / multi-peer transport via BroadcastChannel + optional WebRTC ----------
  // BroadcastChannel works across tabs on same origin; for cross-origin we rely on the host app
  // when users open the room page. For true cross-site we inject a small bridge.

  const channel = new BroadcastChannel(`synerdio-${ROOM}`)

  function broadcast(msg) {
    try {
      channel.postMessage({ ...msg, from: selfName, t: Date.now() })
    } catch (_) {}
  }

  channel.onmessage = (ev) => {
    const msg = ev.data
    if (!msg || msg.from === selfName) return

    if (msg.type === 'cursor') {
      let el = cursors.get(msg.from)
      if (!el) {
        el = document.createElement('div')
        el.className = 'synerdio-cursor'
        el.dataset.name = msg.name || msg.from
        document.documentElement.appendChild(el)
        cursors.set(msg.from, el)
      }
      el.style.left = msg.x + 'px'
      el.style.top = msg.y + 'px'
    }

    if (msg.type === 'highlight' && msg.selector) {
      clearLocalHighlight()
      try {
        const target = document.querySelector(msg.selector)
        if (target) target.classList.add('synerdio-highlight')
      } catch (_) {}
    }

    if (msg.type === 'metrics') {
      // Store for potential panel consumption
      window.__synerdioLastMetrics = msg
    }
  }

  // Inject minimal CSS for highlighters & cursors
  const css = document.createElement('style')
  css.textContent = `
    .synerdio-highlight {
      outline: 2px solid #00F0FF !important;
      outline-offset: 2px !important;
      background-color: rgba(0, 240, 255, 0.08) !important;
    }
    .synerdio-cursor {
      position: fixed;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid #00F0FF;
      pointer-events: none;
      z-index: 2147483646;
      transform: translate(-50%, -50%);
      transition: left 0.07s linear, top 0.07s linear;
    }
    .synerdio-cursor::after {
      content: attr(data-name);
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      background: #0B0F19;
      color: #00F0FF;
      font: 10px/1.2 system-ui, sans-serif;
      padding: 2px 5px;
      border-radius: 3px;
      white-space: nowrap;
      border: 1px solid rgba(0,240,255,0.35);
    }
  `
  document.head.appendChild(css)

  // Floating badge so user knows agent is live
  const badge = document.createElement('div')
  badge.innerHTML = `
    <div style="
      position:fixed;bottom:16px;right:16px;z-index:2147483647;
      background:#0B0F19;color:#00F0FF;border:1px solid rgba(0,240,255,0.4);
      padding:8px 12px;border-radius:8px;font:12px/1.3 system-ui,sans-serif;
      box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;
    ">
      <span style="width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 8px #10B981;"></span>
      Synerdio · ${ROOM}
      <a href="${ORIGIN}/?room=${ROOM}" target="_blank" style="color:#00F0FF;margin-left:4px;">Open panel</a>
    </div>
  `
  document.documentElement.appendChild(badge)

  console.log('%c[Synerdio] Agent ready. Ctrl/Cmd+Click to highlight. Cursors are shared.', 'color:#10B981')
})()
