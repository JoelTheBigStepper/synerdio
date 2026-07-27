/**
 * Synerdio Agent — Trystero peer via CDN
 */
(function () {
  if (window.__synerdioAgent) { console.warn("[synerdio] already running"); return; }
  window.__synerdioAgent = true;
  var scriptEl = document.currentScript;
  var ROOM = (scriptEl && scriptEl.dataset && scriptEl.dataset.room) ||
    new URLSearchParams(location.search).get("synerdio") ||
    (typeof prompt === "function" ? prompt("Synerdio room ID") : "") || "";
  if (!ROOM) { console.warn("[synerdio] no room id"); window.__synerdioAgent = false; return; }
  var selfName = localStorage.getItem("synerdio-name") || ("dev-" + Math.floor(Math.random() * 9000 + 1000));
  var ORIGIN = scriptEl && scriptEl.src ? new URL(scriptEl.src).origin : location.origin;
  var APP_ID = "synerdio-v1";
  console.log("%c[synerdio] loading trystero room=" + ROOM, "color:#00F0FF;font-weight:bold");

  var style = document.createElement("style");
  style.textContent = ".synerdio-highlight{outline:1.5px solid #00F0FF!important;outline-offset:1px!important;background-color:rgba(0,240,255,.07)!important}.synerdio-cursor{position:fixed;width:14px;height:14px;border-radius:50%;border:1.5px solid #00F0FF;pointer-events:none;z-index:2147483646;transform:translate(-50%,-50%);transition:left .06s linear,top .06s linear}.synerdio-cursor::after{content:attr(data-name);position:absolute;top:16px;left:50%;transform:translateX(-50%);background:#0B0F19;color:#00F0FF;font:10px/1.2 ui-monospace,monospace;padding:1px 5px;white-space:nowrap;border:1px solid rgba(0,240,255,.35)}#synerdio-badge{position:fixed;bottom:12px;right:12px;z-index:2147483647;background:#0B0F19;color:#E2E8F0;border:1px solid #1E293B;font:11px/1.3 ui-monospace,monospace;padding:6px 10px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,.45)}#synerdio-badge .dot{width:7px;height:7px;border-radius:50%;background:#F59E0B}#synerdio-badge .dot.on{background:#10B981;box-shadow:0 0 6px #10B981}#synerdio-badge a{color:#00F0FF;text-decoration:none}";
  document.documentElement.appendChild(style);
  var badge = document.createElement("div");
  badge.id = "synerdio-badge";
  badge.innerHTML = '<span class="dot" id="synerdio-dot"></span><span>synerdio · ' + ROOM + '</span><a href="' + ORIGIN + '/?room=' + ROOM + '" target="_blank" rel="noopener">panel</a>';
  document.documentElement.appendChild(badge);
  var dot = badge.querySelector("#synerdio-dot");

  function start(joinRoom) {
    var room;
    try { room = joinRoom({ appId: APP_ID }, ROOM); } catch (err) { console.error("[synerdio] join failed", err); return; }
    function act(n) { var p = room.makeAction(n); return { send: p[0], get: p[1] }; }
    var presence = act("presence"), cursor = act("cursor"), highlight = act("highlight");
    var metrics = act("metrics"), patchApply = act("patchApply"), patchRevert = act("patchRevert");
    presence.send({ name: selfName });
    dot.classList.add("on");
    console.log("%c[synerdio] connected as peer", "color:#10B981");
    room.onPeerJoin(function (id) { console.log("[synerdio] peer joined", id); presence.send({ name: selfName }); });
    var cursorEls = new Map();
    function upsertCursor(peerId, x, y, name) {
      var el = cursorEls.get(peerId);
      if (!el) { el = document.createElement("div"); el.className = "synerdio-cursor"; document.documentElement.appendChild(el); cursorEls.set(peerId, el); }
      el.style.left = x + "px"; el.style.top = y + "px"; el.dataset.name = name || "peer";
    }
    function removeCursor(peerId) { var el = cursorEls.get(peerId); if (el) { el.remove(); cursorEls.delete(peerId); } }
    room.onPeerLeave(function (id) { removeCursor(id); });
    cursor.get(function (data, peerId) { if (data && data.x != null) upsertCursor(peerId, data.x, data.y, data.name); });
    var lastCursor = 0;
    function onMouseMove(e) {
      var now = performance.now(); if (now - lastCursor < 45) return; lastCursor = now;
      cursor.send({ x: e.clientX, y: e.clientY, name: selfName });
    }
    document.addEventListener("mousemove", onMouseMove, { passive: true });

    function uniqueSelector(el) {
      if (el.id) return "#" + CSS.escape(el.id);
      var parts = [], cur = el;
      while (cur && cur.nodeType === 1 && parts.length < 5) {
        var part = cur.tagName.toLowerCase();
        if (cur.classList && cur.classList.length) {
          var cls = Array.prototype.slice.call(cur.classList, 0, 2).map(function (c) { return CSS.escape(c); }).join(".");
          if (cls) part += "." + cls;
        }
        parts.unshift(part); cur = cur.parentElement;
      }
      return parts.join(" > ");
    }
    function clearHighlights() {
      document.querySelectorAll(".synerdio-highlight").forEach(function (n) { n.classList.remove("synerdio-highlight"); });
    }
    function onClick(e) {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault(); e.stopPropagation();
      var selector = uniqueSelector(e.target);
      clearHighlights(); e.target.classList.add("synerdio-highlight");
      highlight.send({ selector: selector, name: selfName });
    }
    document.addEventListener("click", onClick, true);
    highlight.get(function (data) {
      if (!data || !data.selector) return;
      clearHighlights();
      try { var t = document.querySelector(data.selector); if (t) t.classList.add("synerdio-highlight"); } catch (_) {}
    });

    window.__synerdioLongTasks = window.__synerdioLongTasks || [];
    var obs;
    try {
      obs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          window.__synerdioLongTasks.push({ duration: Math.round(e.duration), start: Math.round(e.startTime) });
        });
        window.__synerdioLongTasks = window.__synerdioLongTasks.slice(-20);
      });
      obs.observe({ type: "longtask", buffered: true });
    } catch (_) {}
    function collectMetrics() {
      var nav = performance.getEntriesByType("navigation")[0];
      var resources = performance.getEntriesByType("resource").slice(-20);
      return {
        ts: Date.now(), url: location.href,
        timing: nav ? { ttfb: Math.round(nav.responseStart - nav.requestStart),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          load: Math.round(nav.loadEventEnd - nav.startTime) } : null,
        resources: resources.map(function (r) {
          return { name: (r.name.split("/").pop() || r.name).slice(0, 48), duration: Math.round(r.duration), size: r.transferSize || 0, type: r.initiatorType };
        }),
        memory: performance.memory ? { used: Math.round(performance.memory.usedJSHeapSize / 1048576), total: Math.round(performance.memory.totalJSHeapSize / 1048576) } : null,
        longTasks: window.__synerdioLongTasks.slice(-10)
      };
    }
    var metricsInterval = setInterval(function () { try { metrics.send(collectMetrics()); } catch (_) {} }, 3500);
    setTimeout(function () { try { metrics.send(collectMetrics()); } catch (_) {} }, 800);

    var applied = new Map();
    window.__synerdioApplyPatch = function (patch) {
      if (!patch || !patch.id) return;
      if (patch.css) {
        var el = document.createElement("style");
        el.dataset.synerdioPatch = patch.id;
        el.textContent = patch.css;
        document.head.appendChild(el);
        applied.set(patch.id, el);
      }
      if (patch.js) { try { Function(patch.js)(); } catch (err) { console.error("[synerdio] patch js", err); } }
      console.log("%c[synerdio] patch applied", "color:#10B981", patch.description || patch.id);
    };
    window.__synerdioRevertPatch = function (id) {
      var el = applied.get(id); if (el) { el.remove(); applied.delete(id); }
    };
    patchApply.get(function (data) { window.__synerdioApplyPatch(data); });
    patchRevert.get(function (data) { if (data && data.id) window.__synerdioRevertPatch(data.id); });
    window.__synerdioLeave = function () {
      try { room.leave(); } catch (_) {}
      try { if (obs) obs.disconnect(); } catch (_) {}
      clearInterval(metricsInterval);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("click", onClick, true);
      cursorEls.forEach(function (el) { el.remove(); });
      cursorEls.clear(); badge.remove(); style.remove();
      window.__synerdioAgent = false;
      console.log("[synerdio] left");
    };
  }
  var s = document.createElement("script");
  s.type = "module";
  s.textContent = 'import { joinRoom } from "https://esm.sh/trystero@0.22.0"; window.__synerdioJoinRoom = joinRoom; window.dispatchEvent(new Event("synerdio-trystero-ready"));';
  document.documentElement.appendChild(s);
  window.addEventListener("synerdio-trystero-ready", function () {
    if (window.__synerdioJoinRoom) start(window.__synerdioJoinRoom);
    else console.error("[synerdio] trystero CDN failed");
  }, { once: true });
})();