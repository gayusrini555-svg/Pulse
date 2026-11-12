import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mirror, evidence, judgeCall, matchRowsToPosts, normaliseMetrics, extractFeedText, badges } from '../lib/pulse.js'

const mk = (n, lever, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `${lever}${i}`, lever, ...extra }))

test('mirror finds the main archetype and a streak', () => {
  const posts = [...mk(12, 'specificity'), ...mk(6, 'contrarian'), ...mk(2, 'narrative')]
  const m = mirror(posts)
  assert.equal(m.primary, 'librarian')
  assert.equal(m.streak, 'spark')
  assert.equal(m.levers[0].key, 'specificity')
})

test('mirror needs at least 5 posts', () => {
  assert.equal(mirror(mk(3, 'utility')).enough, false)
})

test('mirror flags a shift when recent posts lean elsewhere', () => {
  const posts = [...mk(6, 'contrarian'), ...mk(3, 'specificity'), ...mk(20, 'specificity').map((p, i) => ({ ...p, id: 'old' + i }))]
  assert.equal(mirror(posts).shift?.to, 'spark')
})

test('evidence computes lift against the median and labels small samples', () => {
  const posts = [
    ...mk(6, 'specificity').map((p) => ({ ...p, metrics: { engagementRate: 6 } })),
    ...mk(8, 'authority').map((p) => ({ ...p, metrics: { engagementRate: 3 } })),
    ...mk(2, 'contrarian').map((p) => ({ ...p, metrics: { engagementRate: 9 } })),
  ]
  const ev = evidence(posts, 'expert')
  assert.equal(ev.enough, true)
  const spec = ev.levers.find((l) => l.key === 'specificity')
  assert.equal(spec.verdict, 'Works for you')
  assert.equal(ev.levers.find((l) => l.key === 'contrarian').verdict, 'Early signal')
  assert.equal(ev.levers.find((l) => l.key === 'authority').verdict, 'Works against you')
  assert.ok(badges(ev).librarian >= 1)
})

test('engagement rate is derived when missing', () => {
  const ev = evidence(mk(4, 'utility').map((p, i) => ({ ...p, metrics: { impressions: 100, reactions: 5 + i } })))
  assert.equal(ev.enough, true)
})

test('judging predictions', () => {
  assert.equal(judgeCall('yes', 20), 'Called it')
  assert.equal(judgeCall('yes', -5), 'Missed')
  assert.equal(judgeCall('no', 30), 'Underestimated')
  assert.equal(judgeCall('no', null), 'Waiting for results')
})

test('normalises Buffer metric arrays and export columns', () => {
  assert.deepEqual(normaliseMetrics([{ type: 'impressions', value: 120 }, { type: 'engagementRate', value: 4.2 }]), { impressions: 120, engagementRate: 4.2 })
  assert.equal(normaliseMetrics({ 'Impressions': '1,234', 'Reactions': 10 }).impressions, 1234)
})

test('matches export rows to posts by date', () => {
  const rows = [{ 'Post publish date': '2026-11-03', Impressions: 500, Engagements: 20 }]
  const posts = [{ id: 'a', publishedAt: '2026-11-03T08:40:00Z' }, { id: 'b', publishedAt: '2026-11-04T08:40:00Z' }]
  const m = matchRowsToPosts(rows, posts)
  assert.equal(m.a.impressions, 500)
  assert.equal(m.b, undefined)
})

test('reads RSS items', () => {
  const xml = '<rss><channel><item><title>Is a SIP enough?</title><description><![CDATA[<p>Readers ask</p>]]></description></item></channel></rss>'
  assert.match(extractFeedText(xml), /Is a SIP enough\?: Readers ask/)
})

import { evidence as ev2 } from '../lib/pulse.js'
test('evidence analyses every metric; goal only picks the first view', () => {
  const posts = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, lever: ['utility', 'narrative', 'vulnerability'][i % 3], metrics: { comments: [0, 0, 0, 0, 2, 0, 0, 1, 0, 3, 0, 0][i], engagementRate: 1 + i / 3, impressions: 100 + i * 20 } }))
  const e = ev2(posts, 'conversations')
  assert.equal(e.metricKey, 'comments')
  assert.equal(e.basis, 'average')
  assert.deepEqual(Object.keys(e.lenses).sort(), ['comments', 'engagementRate', 'impressions'])
  const noComments = ev2(posts.map((p) => ({ ...p, metrics: { ...p.metrics, comments: 0 } })), 'conversations')
  assert.equal(noComments.metricKey, 'engagementRate')
  assert.equal(noComments.goalFallback, true)
  assert.equal(ev2(posts.map((p) => ({ ...p, metrics: { comments: 0 } })), 'expert').enough, false)
  assert.equal(ev2(posts.slice(0, 2), 'expert').enough, false)
})
