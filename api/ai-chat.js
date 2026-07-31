// Vercel Serverless Function — works alongside the Vite app automatically
// when deployed to Vercel (no framework-specific config needed). For local
// testing, run `vercel dev` instead of `vite dev` so this route is served;
// plain `vite dev` won't have an /api endpoint to hit.
//
// Requires GROQ_API_KEY to be set in the Vercel project's environment
// variables (Settings → Environment Variables) — free, no card required,
// from console.groq.com/keys. Never expose this key to the client — that's
// the whole point of this file existing.

const MODEL = 'llama-3.3-70b-versatile'
const MAX_TOKENS = 400
const MAX_MESSAGE_LENGTH = 2000
const MAX_HISTORY_TURNS = 6

// Soft, per-instance rate limit. This resets on cold starts and isn't
// shared across concurrent instances, so it's a speed bump against
// obvious spam — not a real quota system. For anything beyond a
// hackathon/demo, swap this for Vercel KV or Upstash Redis.
const RATE_LIMIT = 12
const RATE_WINDOW_MS = 60_000
const rateLimitMap = new Map()

function isRateLimited(key) {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS)
  timestamps.push(now)
  rateLimitMap.set(key, timestamps)
  return timestamps.length > RATE_LIMIT
}

function summarizeMetrics(m) {
  if (!m) return 'No metrics received yet — the agent may not be connected to the target page.'
  const lines = []
  if (m.url) lines.push(`URL: ${m.url}`)
  if (m.timing) {
    lines.push(`TTFB: ${m.timing.ttfb ?? '—'} ms`)
    lines.push(`DOM Content Loaded: ${m.timing.domContentLoaded ?? '—'} ms`)
    lines.push(`Load: ${m.timing.load ?? '—'} ms`)
  }
  if (m.memory) {
    lines.push(`JS heap: ${m.memory.used} / ${m.memory.total} MB`)
  }
  const longTasks = Array.isArray(m.longTasks) ? m.longTasks : []
  lines.push(
    `Long tasks (page froze, \u226550ms): ${longTasks.length}` +
      (longTasks.length ? `, longest ${Math.max(...longTasks.map((t) => t.duration))} ms` : '')
  )
  const resources = Array.isArray(m.resources) ? m.resources : []
  const slow = resources.filter((r) => r.duration > 300)
  lines.push(
    `Resources loaded: ${resources.length}, ${slow.length} slower than 300ms` +
      (slow.length ? ': ' + slow.slice(0, 5).map((r) => `${r.name} (${r.duration}ms)`).join(', ') : '')
  )
  return lines.join('\n')
}

function buildSystemPrompt(metrics) {
  return [
    'You are the AI Pair inside Synerdio, a collaborative live web-debugging tool.',
    "You're given live performance metrics for the page a developer is currently debugging.",
    "Answer questions about performance (jank, network, memory, TTFB, long tasks) using ONLY the data below — don't invent numbers that aren't there.",
    "If something isn't in the data, say so plainly instead of guessing.",
    'Keep answers short: a few sentences, concrete and practical. No generic web-performance lecture unless asked for one.',
    '',
    'Current metrics snapshot:',
    summarizeMetrics(metrics),
  ].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed', message: 'Use POST.' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('[ai-chat] GROQ_API_KEY is not set')
    return res
      .status(500)
      .json({ error: 'not_configured', message: 'AI backend is not configured on the server.' })
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({ error: 'rate_limited', message: 'Too many requests — slow down a bit and try again.' })
  }

  const { message, history, metrics } = req.body || {}

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing "message".' })
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'bad_request', message: 'Message is too long.' })
  }

  const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : []
  const messages = [
    { role: 'system', content: buildSystemPrompt(metrics) },
    ...trimmedHistory
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .map((m) => ({ role: m.role, content: m.text.slice(0, MAX_MESSAGE_LENGTH) })),
    { role: 'user', content: message.trim() },
  ]

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages,
      }),
    })

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      console.error('[ai-chat] Groq API error', upstream.status, errText)
      return res.status(502).json({ error: 'upstream_error', message: 'AI service returned an error.' })
    }

    const data = await upstream.json()
    const reply = data.choices?.[0]?.message?.content?.trim()

    if (!reply) {
      return res.status(502).json({ error: 'empty_response', message: 'AI service returned no text.' })
    }

    return res.status(200).json({ reply })
  } catch (err) {
    console.error('[ai-chat] request failed', err)
    return res.status(500).json({ error: 'request_failed', message: 'Failed to reach the AI service.' })
  }
}