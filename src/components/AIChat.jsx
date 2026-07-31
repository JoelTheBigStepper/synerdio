import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Sparkles, WifiOff } from 'lucide-react'

/**
 * AI pair panel. Calls the server-proxied Claude endpoint (/api/ai-chat)
 * for real answers grounded in the live metrics. If that's unreachable —
 * API key not configured, rate limited, network hiccup — it quietly falls
 * back to local keyword heuristics rather than showing an error, with a
 * small "(offline)" tag so it's clear which one actually answered.
 */
export default function AIChat({ metrics }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi — I can reason about the live metrics in this room. Ask me about TTFB, long tasks, large resources, or possible causes of jank.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Offline fallback — only used if the real AI request fails for any
  // reason, so the chat still says *something* useful.
  const heuristicReply = (userText) => {
    const m = metrics || {}
    const lower = userText.toLowerCase()

    if (lower.includes('long task') || lower.includes('jank') || lower.includes('slow')) {
      const tasks = m.longTasks || []
      if (tasks.length === 0) {
        return 'No long tasks recorded yet in this room. Interact with the page or inject the agent on a heavier site to capture them.'
      }
      const worst = Math.max(...tasks.map((t) => t.duration))
      return `I see ${tasks.length} long task(s). The longest was ~${worst} ms. Long tasks > 50 ms block the main thread and cause jank. Consider breaking work into smaller chunks or moving heavy logic off the main thread.`
    }

    if (lower.includes('ttfb') || lower.includes('network') || lower.includes('resource')) {
      const ttfb = m.timing?.ttfb
      const heavy = (m.resources || []).filter((r) => r.duration > 300).slice(0, 3)
      let out = ttfb != null ? `TTFB is ${ttfb} ms. ` : ''
      if (heavy.length) {
        out += `Slow resources: ${heavy.map((r) => `${r.name} (${r.duration} ms)`).join(', ')}.`
      } else {
        out += 'No particularly slow resources in the current sample.'
      }
      return out || 'No timing data yet.'
    }

    if (lower.includes('memory') || lower.includes('heap')) {
      if (m.memory) {
        return `JS heap is at ${m.memory.used} MB / ${m.memory.total} MB. Rising heap without recovery can indicate a leak.`
      }
      return 'Memory metrics are only available in Chromium-based browsers via performance.memory.'
    }

    if (lower.includes('fix') || lower.includes('patch') || lower.includes('css')) {
      return 'You can propose a temporary CSS/JS patch in the Patches tab. Peers vote, then it applies for the whole room. Example: `.heavy { contain: layout style; }` or `will-change: transform` on animated elements.'
    }

    return `I can help with: long tasks / jank, TTFB & network, memory, and temporary patches. Current page sample: ${m.url ? new URL(m.url).hostname : 'unknown'}.`
  }

  const fetchAIReply = async (message, history) => {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        metrics,
        history: history.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || `AI request failed (${res.status})`)
    }
    const data = await res.json()
    if (!data.reply) throw new Error('Empty AI response')
    return data.reply
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    const text = input.trim()
    setInput('')
    const nextMessages = [...messages, { role: 'user', text }]
    setMessages(nextMessages)
    setBusy(true)

    try {
      const aiText = await fetchAIReply(text, nextMessages)
      setMessages((m) => [...m, { role: 'assistant', text: aiText, source: 'ai' }])
    } catch (err) {
      console.warn('[synerdio] AI chat falling back to offline heuristics:', err.message)
      const fallbackText = heuristicReply(text)
      setMessages((m) => [...m, { role: 'assistant', text: fallbackText, source: 'heuristic' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-[420px]">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-cyan" />
        AI Pair
        <span className="text-xs font-normal text-slate ml-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Groq-powered · falls back to offline heuristics
        </span>
      </h3>

      <div className="flex-1 overflow-auto space-y-3 mb-4 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan/20 text-cyan border border-cyan/30 rounded-br-md'
                  : 'bg-midnight-lighter border border-cyan/10 rounded-bl-md'
              }`}
            >
              {msg.text}
              {msg.source === 'heuristic' && (
                <span className="flex items-center gap-1 mt-1.5 text-[10px] text-amber">
                  <WifiOff className="w-2.5 h-2.5" />
                  offline — AI service unavailable
                </span>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-xs text-slate animate-pulse">Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Why is this page janky?"
          className="flex-1 px-4 py-2.5 rounded-xl bg-midnight-lighter border border-cyan/20 outline-none focus:border-cyan text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 rounded-xl bg-cyan text-midnight hover:bg-cyan-dim transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}