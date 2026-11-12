// Pulse's research logic: the lever codebook, archetypes, baselines and lift.
// Everything here is plain functions so it can be unit tested without the network.

/* ------------------------------------------------------------- codebook */
// Each lever is grounded in published research so every label is defensible.
export const LEVERS = {
  specificity: { name: 'Specificity', archetype: 'librarian', source: 'Concrete detail makes ideas credible and memorable (Heath & Heath, Made to Stick)', def: 'Leads with exact numbers, named examples or precise detail.' },
  authority: { name: 'Authority', archetype: 'librarian', source: 'Cialdini, Influence: the principle of authority', def: 'Leans on expertise, research, credentials or named experts.' },
  contrarian: { name: 'Contrarian framing', archetype: 'spark', source: 'Surprise drives sharing (Berger & Milkman, 2012)', def: 'Challenges a common belief or default advice.' },
  curiosity_gap: { name: 'Curiosity gap', archetype: 'spark', source: 'Loewenstein (1994): the information-gap theory of curiosity', def: 'Opens a question or gap the reader wants closed.' },
  narrative: { name: 'Narrative', archetype: 'storyteller', source: 'Stories transport readers and aid persuasion (Green & Brock, 2000)', def: 'Tells a story with a moment, a character and a turn.' },
  vulnerability: { name: 'Vulnerability', archetype: 'storyteller', source: 'High-arousal emotion predicts sharing (Berger & Milkman, 2012)', def: 'Shares a mistake, struggle or honest feeling.' },
  utility: { name: 'Utility', archetype: 'coach', source: 'Practical value predicts sharing (Berger, Contagious: STEPPS)', def: 'Gives steps, frameworks, tips or a checklist.' },
  loss_framing: { name: 'Loss framing', archetype: 'coach', source: 'Kahneman & Tversky (1979): prospect theory, losses loom larger', def: 'Frames what the reader stands to lose or avoid.' },
  reciprocity: { name: 'Reciprocity', archetype: 'host', source: 'Cialdini, Influence: the principle of reciprocity', def: 'Gives first or asks the audience to reply and take part.' },
  belonging: { name: 'Belonging', archetype: 'host', source: 'Cialdini, Pre-Suasion: the principle of unity', def: 'Speaks to a shared identity: "people like us".' },
  social_proof: { name: 'Social proof', archetype: 'curator', source: 'Cialdini, Influence: the principle of social proof', def: 'Points to what many others do, say or recommend.' },
  novelty: { name: 'Novelty', archetype: 'curator', source: 'Interesting and surprising content is shared more (Berger & Milkman, 2012)', def: 'Shares something new, a trend or a discovery.' },
}
export const LEVER_KEYS = Object.keys(LEVERS)

export const ARCHETYPES = {
  librarian: { name: 'The Librarian', line: 'Research-led, precise, cites evidence.', color: '#3D63F0' },
  spark: { name: 'The Spark', line: 'Bold takes, challenges the default view.', color: '#E8473B' },
  storyteller: { name: 'The Storyteller', line: 'Personal stories, lessons from experience.', color: '#E85BA6' },
  coach: { name: 'The Coach', line: 'Practical how-tos and frameworks.', color: '#F4B71E' },
  host: { name: 'The Host', line: 'Starts conversations, invites people in.', color: '#2FB57C' },
  curator: { name: 'The Curator', line: 'Points to the best of what others made.', color: '#8C6CF0' },
}
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES)

export const GOALS = {
  expert: { label: 'Be known as an expert', metric: 'engagement rate' },
  conversations: { label: 'Start conversations', metric: 'comments' },
  reach: { label: 'Reach more people', metric: 'impressions' },
  enquiries: { label: 'Get enquiries', metric: 'clicks' },
}

/* ----------------------------------------------------------- archetypes */
// Share of posts whose main lever belongs to each archetype (secondary counts half).
export function archetypeMix(posts) {
  const score = Object.fromEntries(ARCHETYPE_KEYS.map((k) => [k, 0]))
  let total = 0
  for (const p of posts) {
    const a = LEVERS[p.lever]?.archetype
    if (a) { score[a] += 1; total += 1 }
    const b = LEVERS[p.secondary]?.archetype
    if (b) { score[b] += 0.5; total += 0.5 }
  }
  return Object.fromEntries(ARCHETYPE_KEYS.map((k) => [k, total ? score[k] / total : 0]))
}

export function leverShare(posts) {
  const counts = {}
  for (const p of posts) if (LEVERS[p.lever]) counts[p.lever] = (counts[p.lever] || 0) + 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => ({ key, name: LEVERS[key].name, archetype: LEVERS[key].archetype, n, share: n / posts.length }))
}

const ranked = (mix) => Object.entries(mix).sort((a, b) => b[1] - a[1])

// posts must be newest first.
export function mirror(posts) {
  if (posts.length < 5) return { enough: false, count: posts.length }
  const window = posts.slice(0, 30)
  const mix = archetypeMix(window)
  const [[primary], [second, secondShare]] = ranked(mix)
  const streak = secondShare >= 0.2 ? second : null

  // Shift: the last 9 posts lean a different way than the 30 before them.
  let shift = null
  if (posts.length >= 15) {
    const recent = ranked(archetypeMix(posts.slice(0, 9)))[0]
    const before = ranked(archetypeMix(posts.slice(9, 39)))[0]
    if (recent[0] !== before[0] && recent[1] >= 0.4) {
      const n = posts.slice(0, 9).filter((p) => LEVERS[p.lever]?.archetype === recent[0]).length
      shift = { from: before[0], to: recent[0], recentCount: n, recentOf: 9 }
    }
  }
  return { enough: true, count: posts.length, analysed: window.length, primary, streak, mix, levers: leverShare(window), shift }
}

/* ------------------------------------------------------------- evidence */
export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

const num = (x) => {
  if (typeof x === 'number') return x
  const n = parseFloat(String(x ?? '').replace(/[,%\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

// Normalise Buffer metrics ([{type,name,value}]) or export rows into one shape.
export function normaliseMetrics(raw) {
  const out = {}
  const put = (label, value) => {
    const k = String(label || '').toLowerCase()
    const v = num(value)
    if (v == null) return
    if (/engagement.?rate/.test(k)) out.engagementRate = v
    else if (/click.?through|ctr\b|\brate\b|video|follow/.test(k)) return // rates and side metrics would overwrite real counts
    else if (/impression/.test(k) || /^(post )?views?$/.test(k)) out.impressions ??= v
    else if (/reach/.test(k)) out.reach ??= v
    else if (/comment/.test(k)) out.comments ??= v
    else if (/click/.test(k)) out.clicks ??= v
    else if (/reaction|like/.test(k)) out.reactions ??= v
    else if (/share|repost/.test(k)) out.shares ??= v
    else if (/engagement/.test(k)) out.engagements ??= v
  }
  if (Array.isArray(raw)) for (const m of raw) put(m.type || m.name, m.value)
  else if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) put(k, v)
  return out
}

export function metricFor(m, goal) {
  if (!m) return null
  if (goal === 'conversations') return m.comments ?? null
  if (goal === 'reach') return m.impressions ?? m.reach ?? null
  if (goal === 'enquiries') return m.clicks ?? null
  if (m.engagementRate != null) return m.engagementRate
  const eng = m.engagements ?? ((m.reactions || 0) + (m.comments || 0) + (m.shares || 0) + (m.clicks || 0))
  const base = m.impressions ?? m.reach
  return base ? (eng / base) * 100 : null
}

// Every number Pulse can analyse. The goal only picks which one is shown first.
export const METRICS = {
  engagementRate: 'engagement rate',
  impressions: 'impressions',
  reach: 'people reached',
  reactions: 'reactions',
  comments: 'comments',
  shares: 'reposts',
  clicks: 'clicks',
}
const GOAL_METRIC = { expert: 'engagementRate', conversations: 'comments', reach: 'impressions', enquiries: 'clicks' }
const valueOf = (m, key) => {
  if (!m) return null
  if (key === 'engagementRate') return metricFor(m, 'expert')
  const v = m[key]
  return Number.isFinite(v) ? v : null
}
const average = (vals) => { const v = vals.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }

// One metric: baseline (median, or average when most posts score 0) and lift per lever.
function lens(posts, key) {
  const scored = posts.map((p) => ({ ...p, value: valueOf(p.metrics, key) })).filter((p) => p.value != null && p.value >= 0)
  if (scored.length < 3) return null
  const vals = scored.map((p) => p.value)
  let centre = median
  let basis = 'median'
  if (!median(vals)) { centre = average; basis = 'average' }
  const baseline = centre(vals)
  if (!baseline) return null // all zero: nothing to compare
  const lift = (v) => Math.round((v / baseline - 1) * 100)
  const byLever = {}
  for (const p of scored) if (LEVERS[p.lever]) (byLever[p.lever] ||= []).push(p.value)
  const levers = Object.entries(byLever).map(([k, v]) => {
    const l = lift(centre(v))
    const n = v.length
    const verdict = n < 5 ? 'Early signal' : l >= 10 ? 'Works for you' : l <= -10 ? 'Works against you' : 'No clear effect'
    return { key: k, name: LEVERS[k].name, archetype: LEVERS[k].archetype, n, lift: l, verdict }
  }).sort((a, b) => b.lift - a.lift)
  return { key, label: METRICS[key], basis, baseline, measured: scored.length, levers, postLift: Object.fromEntries(scored.map((p) => [p.id, lift(p.value)])) }
}

// posts: [{id, lever, metrics}] → a lens per metric, plus the default lens for the goal.
export function evidence(posts, goal = 'expert') {
  const withNumbers = posts.filter((p) => p.metrics && Object.keys(p.metrics).length)
  const lenses = {}
  const skipped = []
  for (const key of Object.keys(METRICS)) {
    const l = lens(withNumbers, key)
    if (l) lenses[key] = l
    else if (withNumbers.some((p) => valueOf(p.metrics, key) != null)) skipped.push(METRICS[key])
  }
  const goalKey = GOAL_METRIC[goal] || 'engagementRate'
  const primaryKey = lenses[goalKey] ? goalKey : lenses.engagementRate ? 'engagementRate' : Object.keys(lenses)[0]
  if (!primaryKey) return { enough: false, measured: withNumbers.length, zero: withNumbers.length >= 3, skipped }
  const P = lenses[primaryKey]
  // How consistent is each lever across all the numbers?
  const consistency = Object.fromEntries(P.levers.map((l) => {
    const lifts = Object.values(lenses).map((x) => x.levers.find((y) => y.key === l.key)?.lift).filter((x) => x != null)
    return [l.key, { up: lifts.filter((x) => x >= 10).length, down: lifts.filter((x) => x <= -10).length, of: lifts.length }]
  }))
  return {
    enough: true, measured: P.measured, baseline: P.baseline, basis: P.basis, metric: P.label, metricKey: primaryKey,
    goalKey, goalMetric: METRICS[goalKey], goalFallback: primaryKey !== goalKey,
    levers: P.levers, postLift: P.postLift, lenses, consistency, skipped,
  }
}

export function judgeCall(prediction, lift) {
  if (lift == null) return 'Waiting for results'
  if (prediction === 'yes') return lift > 0 ? 'Called it' : 'Missed'
  return lift > 0 ? 'Underestimated' : 'Called it'
}

// Badges: posts on an archetype's levers that beat the user's usual (max 6).
export function badges(ev) {
  const out = Object.fromEntries(ARCHETYPE_KEYS.map((k) => [k, 0]))
  if (!ev?.enough) return out
  for (const l of ev.levers) if (l.verdict === 'Works for you') out[l.archetype] = Math.min(6, out[l.archetype] + Math.min(3, Math.ceil(l.n / 5)))
  return out
}

/* ------------------------------------------------- analytics file import */
// Match exported rows to Buffer posts by publish date (exports rarely carry text).
export function matchRowsToPosts(rows, posts) {
  if (!rows.length) return {}
  const keys = Object.keys(rows[0])
  const dateKey = keys.find((k) => /date|published|time/i.test(k))
  if (!dateKey) return {}
  const day = (d) => {
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    if (typeof d === 'number') return new Date(Math.round((d - 25569) * 864e5)).toISOString().slice(0, 10) // Excel serial date
    const t = Date.parse(d)
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
  }
  const byDay = {}
  for (const r of rows) {
    const d = day(r[dateKey])
    if (!d) continue
    const m = normaliseMetrics(Object.fromEntries(Object.entries(r).filter(([k]) => k !== dateKey)))
    if (Object.keys(m).length) (byDay[d] ||= []).push(m)
  }
  const out = {}
  for (const p of posts) {
    const d = p.publishedAt ? p.publishedAt.slice(0, 10) : null
    const list = d && byDay[d]
    if (list?.length) out[p.id] = list.shift()
  }
  return out
}

/* --------------------------------------------------------- source feeds */
export function extractFeedText(body) {
  const items = [...body.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0])
  const clean = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
  if (items.length) {
    return items.slice(0, 15).map((it) => {
      const title = clean(it.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
      const desc = clean(it.match(/<(description|summary|content:encoded|content)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || '')
      return `- ${title}: ${desc.slice(0, 400)}`
    }).join('\n')
  }
  return clean(body.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 6000)
}
