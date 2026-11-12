// One AI layer, three providers. Pulse uses whichever key is set (or AI_PROVIDER):
//   gemini  -> GEMINI_API_KEY     (Google Search grounding for trends)
//   claude  -> ANTHROPIC_API_KEY  (Anthropic web search tool)
//   openai  -> OPENAI_API_KEY     (OpenAI web search tool)
// Two calls are exposed: json() for structured research output, search() for
// grounded answers with sources.
import { HttpError, withCause } from './config.js'

const env = (k) => process.env[k]?.trim() || null
const KEYS = { gemini: env('GEMINI_API_KEY'), claude: env('ANTHROPIC_API_KEY'), openai: env('OPENAI_API_KEY') }
const MODELS = {
  gemini: env('GEMINI_MODEL') || 'gemini-3.8-flash',
  claude: env('CLAUDE_MODEL') || 'claude-haiku-5-5',
  openai: env('OPENAI_MODEL') || 'gpt-5-mini',
}
const chosen = env('AI_PROVIDER')
export const PROVIDER = (chosen && KEYS[chosen] ? chosen : null) || ['gemini', 'claude', 'openai'].find((p) => KEYS[p]) || null
export const aiConfigured = () => Boolean(PROVIDER)
export const providerName = () => ({ gemini: 'Google Gemini', claude: 'Anthropic Claude', openai: 'OpenAI GPT' })[PROVIDER] || 'none'

function need() {
  if (!PROVIDER) throw new HttpError(503, 'The AI is not configured on this deployment yet.')
}

async function post(url, headers, body, label) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (res.status === 429) throw new HttpError(429, 'The AI is busy right now. Please try again in a minute.')
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`
    console.error(JSON.stringify({ event: 'ai_error', provider: label, status: res.status, message: msg }))
    throw new HttpError(502, withCause('The AI could not complete that. Please try again.', msg))
  }
  return json
}

// Our schemas use Gemini's uppercase types; standard JSON Schema wants lowercase.
function toJsonSchema(s) {
  if (Array.isArray(s)) return s.map(toJsonSchema)
  if (!s || typeof s !== 'object') return s
  const out = {}
  for (const [k, v] of Object.entries(s)) out[k] = k === 'type' ? String(v).toLowerCase() : toJsonSchema(v)
  if (out.type === 'object') out.additionalProperties = false
  return out
}

function parseJson(text, label) {
  const t = String(text || '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  try {
    return JSON.parse(start >= 0 ? t.slice(start, end + 1) : t)
  } catch {
    console.error(JSON.stringify({ event: 'ai_bad_json', provider: label, sample: t.slice(0, 200) }))
    throw new HttpError(502, 'The AI returned something unreadable. Please try again.')
  }
}

/* ------------------------------------------------------------ providers */
const gemini = {
  url: () => `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`,
  headers: () => ({ 'x-goog-api-key': KEYS.gemini }),
  text: (j) => (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''),
  async json(prompt, schema, temperature) {
    const j = await post(this.url(), this.headers(), {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature },
    }, 'gemini')
    return parseJson(this.text(j), 'gemini')
  },
  async search(prompt) {
    const j = await post(this.url(), this.headers(), {
      contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.4 },
    }, 'gemini')
    const chunks = j?.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    return { text: this.text(j), sources: chunks.map((c) => c.web).filter(Boolean).map((w) => ({ title: w.title, url: w.uri })) }
  },
}

const claude = {
  headers: () => ({ 'x-api-key': KEYS.claude, 'anthropic-version': '2023-06-01' }),
  text: (j) => (j?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''),
  async json(prompt, schema, temperature) {
    const j = await post('https://api.anthropic.com/v1/messages', this.headers(), {
      model: MODELS.claude, max_tokens: 8000, temperature,
      system: 'You are a careful research assistant. Reply with a single JSON object only, no prose, matching this JSON Schema exactly:\n' + JSON.stringify(toJsonSchema(schema)),
      messages: [{ role: 'user', content: prompt }],
    }, 'claude')
    return parseJson(this.text(j), 'claude')
  },
  async search(prompt) {
    const j = await post('https://api.anthropic.com/v1/messages', this.headers(), {
      model: MODELS.claude, max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: prompt }],
    }, 'claude')
    const sources = (j?.content || []).filter((b) => b.type === 'web_search_tool_result').flatMap((b) => Array.isArray(b.content) ? b.content : [])
      .filter((r) => r.url).map((r) => ({ title: r.title, url: r.url }))
    return { text: this.text(j), sources }
  },
}

const openai = {
  headers: () => ({ Authorization: `Bearer ${KEYS.openai}` }),
  text(j) {
    if (typeof j?.output_text === 'string') return j.output_text
    return (j?.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('')
  },
  async json(prompt, schema) {
    const j = await post('https://api.openai.com/v1/responses', this.headers(), {
      model: MODELS.openai, input: prompt,
      text: { format: { type: 'json_schema', name: 'pulse_output', schema: toJsonSchema(schema), strict: false } },
    }, 'openai')
    return parseJson(this.text(j), 'openai')
  },
  async search(prompt) {
    const j = await post('https://api.openai.com/v1/responses', this.headers(), {
      model: MODELS.openai, input: prompt, tools: [{ type: 'web_search' }],
    }, 'openai')
    const sources = (j?.output || []).flatMap((o) => o.content || []).flatMap((c) => c.annotations || [])
      .filter((a) => a.type === 'url_citation' && a.url).map((a) => ({ title: a.title, url: a.url }))
    return { text: this.text(j), sources }
  },
}

const P = { gemini, claude, openai }

export async function json(prompt, schema, { temperature = 0.3 } = {}) {
  need()
  return P[PROVIDER].json(prompt, schema, temperature)
}

export async function search(prompt) {
  need()
  const out = await P[PROVIDER].search(prompt)
  const seen = new Set()
  const sources = out.sources.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)).slice(0, 5)
    .map((s) => ({ title: String(s.title || s.url).slice(0, 120), url: s.url }))
  return { text: String(out.text || '').trim(), sources }
}

export const S = {
  str: (description) => ({ type: 'STRING', ...(description ? { description } : {}) }),
  int: (description) => ({ type: 'INTEGER', ...(description ? { description } : {}) }),
  bool: (description) => ({ type: 'BOOLEAN', ...(description ? { description } : {}) }),
  enumOf: (values, description) => ({ type: 'STRING', enum: values, ...(description ? { description } : {}) }),
  arr: (items, description) => ({ type: 'ARRAY', items, ...(description ? { description } : {}) }),
  obj: (properties, required = Object.keys(properties)) => ({ type: 'OBJECT', properties, required }),
}
