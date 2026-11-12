// End-to-end flow against a fake Buffer API and a fake Gemini, through real HTTP.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

process.env.SESSION_SECRET = 'x'.repeat(40)
process.env.BUFFER_CLIENT_ID = 'cid'
process.env.GEMINI_API_KEY = 'g'
delete process.env.SUPABASE_URL

const realFetch = globalThis.fetch
const POSTS = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, text: `Post number ${i} with enough words to count as a real post.`, dueAt: `2026-10-${String(10 + i).padStart(2, '0')}T08:00:00Z`, createdAt: null, channelId: 'c1', metrics: [{ type: 'engagementRate', value: i % 2 ? 6 : 3 }] }))
const reply = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } })
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url)
  if (u.startsWith('https://api.buffer.com')) {
    const q = JSON.parse(opts.body).query
    if (q.includes('account {')) return reply({ data: { account: { id: 'u1', name: 'Tester', email: 'x', organizations: [{ id: 'o1', name: 'Org' }] } } })
    if (q.includes('channels(')) return reply({ data: { channels: [{ id: 'c1', name: 'me', displayName: 'Me', service: 'linkedin', isDisconnected: false }] } })
    if (q.includes('posts(')) return reply({ data: { posts: { edges: POSTS.map((p) => ({ node: q.includes('metrics') ? p : { ...p, metrics: undefined } })), pageInfo: { hasNextPage: false, endCursor: null } } } })
    if (q.includes('createPost')) return reply({ data: { createPost: { post: { id: 'new1', text: 't', status: 'draft' } } } })
    if (q.includes('createIdea')) return reply({ data: { createIdea: { id: 'idea1', content: { title: 't', text: 't' } } } })
    return reply({ errors: [{ message: 'unknown query' }] })
  }
  if (u.includes('generativelanguage.googleapis.com')) {
    const body = JSON.parse(opts.body)
    const prompt = body.contents[0].parts[0].text
    let out
    if (prompt.includes('Code each LinkedIn post')) out = { posts: [...prompt.matchAll(/\[((?:p|pasted-)\d+)\]/g)].map((m, i) => ({ id: m[1], lever: i % 2 ? 'specificity' : 'contrarian', secondary: 'none', hook: 'Number-led', emotion: 'Curiosity', why: 'because' })) }
    else if (prompt.includes('Summarise in under 12 words')) out = { summary: 'Money habits', onTopic: 10, matches: true }
    else if (prompt.includes('recurring pain points')) out = { clusters: [{ title: 'Why do I sell low?', count: 5, emotion: 'Frustration', quotes: ['I sold in March'], angle: 'Loss aversion', source: 'Pasted text' }], trending: [] }
    else if (prompt.includes('research brief')) out = { title: 'Brief', hypothesis: 'It will work', drafts: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] }
    else if (prompt.includes('post ideas')) out = { ideas: [{ title: 'Idea', hook: 'Hook', lever: 'utility', why: 'Why' }] }
    else if (prompt.includes('audience labels')) out = { audiences: ['A', 'B'] }
    else if (body.tools) return reply({ candidates: [{ content: { parts: [{ text: 'Answer' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://s.example', title: 'S' } }] } }] })
    return reply({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
  }
  if (u.startsWith('https://feeds.example')) return new Response('<rss><item><title>Why do I sell low?</title><description>help</description></item></rss>', { status: 200 })
  return realFetch(url, opts)
}

let server, base, cookie
before(async () => {
  const { sealData } = await import('iron-session')
  const app = (await import('../lib/app.js')).default
  server = http.createServer(app).listen(0)
  base = `http://127.0.0.1:${server.address().port}`
  const sealed = await sealData({ tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600e3 }, uid: 'u1' }, { password: process.env.SESSION_SECRET })
  cookie = `bsess=${sealed}`
})
after(() => server.close())

async function call(path, body) {
  const res = await realFetch(base + path, body === undefined ? { headers: { cookie } } : { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path} ${res.status} ${json.error}`)
  return json
}

test('signed-in flow from onboarding to evidence', async () => {
  let me = await call('/api/me')
  assert.equal(me.connected, true)
  assert.equal((await call('/api/audiences', { topic: 'money' })).audiences.length, 2)
  await call('/api/onboarding', { topic: 'Money', audiences: ['A'], goal: 'expert', hunch: 'specificity', organizationId: 'o1', channelId: 'c1', channelName: 'Me' })
  let r = await call('/api/mirror', {})
  assert.equal(r.workspace.mirror.enough, true)
  assert.ok(['librarian', 'spark'].includes(r.workspace.mirror.primary))
  r = await call('/api/listen', { text: 'I sold in March', sources: [] })
  assert.equal(r.workspace.clusters.length, 1)
  assert.equal((await call('/api/ideas', { index: 0 })).ok, true)
  r = await call('/api/brief', { index: 0 })
  assert.equal(r.workspace.brief.drafts.length, 3)
  const ideas = (await call('/api/ideas/generate', {})).ideas
  r = await call('/api/brief', { idea: ideas[0] })
  assert.equal(r.workspace.brief.drafts[0].lever, 'utility')
  r = await call('/api/experiments', { text: 'A', lever: 'utility', prediction: 'yes', mode: 'draft' })
  assert.equal(r.workspace.experiments[0].postId, 'new1')
  r = await call('/api/evidence/key', { key: 'personal-key-123' })
  assert.equal(r.workspace.evidence.enough, true)
  assert.ok(r.workspace.evidence.levers.some((l) => l.verdict === 'Works for you'))
  const a = await call('/api/ask', { question: 'What is trending?' })
  assert.equal(a.sources[0].url, 'https://s.example')
  r = await call('/api/evidence/clear', {})
  assert.equal(r.workspace.evidence, null)
  assert.equal(r.workspace.evidenceSource, null)
  assert.equal((await call('/api/delete', {})).deleted, true)
})

test('weekly research job refreshes users with sources', async () => {
  await call('/api/onboarding', { topic: 'Money', audiences: ['A'], goal: 'expert', hunch: 'specificity', organizationId: 'o1', channelId: 'c1', channelName: 'Me' })
  await call('/api/sources', { sources: ['https://feeds.example/rss'] })
  const blocked = await realFetch(base + '/api/cron/research')
  assert.equal(blocked.status, 403)
  const ok = await realFetch(base + '/api/cron/research', { headers: { 'user-agent': 'vercel-cron/1.0' } })
  const body = await ok.json()
  assert.equal(body.refreshed + body.failed, 1)
})

test('few Buffer posts: pasted posts fill the gap', async () => {
  const saved = POSTS.splice(2)
  try {
    await assert.rejects(call('/api/mirror', {}), /needs at least 5/)
    const pasted = Array.from({ length: 4 }, (_, i) => `A pasted LinkedIn post number ${i} that is long enough.`).join('\n\n')
    const r = await call('/api/mirror', { pasted })
    assert.equal(r.workspace.mirror.enough, true)
    assert.equal(r.workspace.mirror.count, 6)
  } finally {
    POSTS.push(...saved)
  }
})
