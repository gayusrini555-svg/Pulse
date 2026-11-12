import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.GEMINI_API_KEY = 'k'
process.env.OPEN_MODEL_API_KEY = 'g'
const ai = await import('../lib/ai.js')

test('when Gemini is busy, the open-source backup answers', async () => {
  const hosts = []
  globalThis.fetch = async (url) => {
    const u = String(url)
    hosts.push(new URL(u).host)
    if (u.includes('googleapis')) return new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503 })
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 })
  }
  const out = await ai.json('hi', ai.S.obj({ ok: ai.S.bool() }))
  assert.equal(out.ok, true)
  assert.ok(hosts.includes('api.groq.com'))
  assert.equal(ai.BACKUP, 'open')
})

test('if web search fails, Ask still answers without sources', async () => {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    if (String(url).includes('googleapis') && body.tools) return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 })
    if (String(url).includes('googleapis')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'plain answer' }] } }] }), { status: 200 })
    return new Response('{}', { status: 500 })
  }
  const out = await ai.search('q')
  assert.equal(out.text, 'plain answer')
  assert.deepEqual(out.sources, [])
})

test('if Gemini search quota is hit, Tavily results give sources', async () => {
  process.env.TAVILY_API_KEY = 't'
  const fresh = await import('../lib/ai.js?tavily')
  globalThis.fetch = async (url, init) => {
    const u = String(url)
    const body = JSON.parse(init.body)
    if (u.includes('tavily')) return new Response(JSON.stringify({ results: [{ title: 'News', url: 'https://ex.com/a', content: 'x' }] }), { status: 200 })
    if (u.includes('googleapis') && body.tools) return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'grounded by tavily' }] } }] }), { status: 200 })
  }
  const out = await fresh.search('q', { query: 'ai validation' })
  assert.equal(out.text, 'grounded by tavily')
  assert.equal(out.sources[0].url, 'https://ex.com/a')
})
