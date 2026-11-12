import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.GEMINI_API_KEY = 'k'
const ai = await import('../lib/ai.js')

test('busy model falls back to the next one', async () => {
  const seen = []
  globalThis.fetch = async (url) => {
    seen.push(String(url).match(/models\/([^:]+)/)[1])
    if (seen.length === 1) return new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 })
  }
  const out = await ai.json('hi', ai.S.obj({ ok: ai.S.bool() }))
  assert.equal(out.ok, true)
  assert.equal(seen.length, 2)
  assert.notEqual(seen[0], seen[1])
})

test('all models busy gives a friendly 503', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503 })
  await assert.rejects(ai.json('hi', ai.S.obj({ ok: ai.S.bool() })), (e) => e.status === 503 && /busy/.test(e.message))
})
