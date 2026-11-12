import express from 'express'
import path from 'node:path'
import XLSX from 'xlsx'
import { HttpError, REDIRECT_URI, loginUnavailableReason, withCause } from './config.js'
import { readSession } from './session.js'
import {
  ACCOUNT_QUERY, CHANNELS_QUERY, CREATE_POST, buildAuthorizeUrl, buildPostInput, createIdeaMutation,
  createPkcePair, createState, exchangeCodeForTokens, fetchSentPosts, graphql, graphqlWithKey,
} from './buffer.js'
import { deleteWorkspace, getWorkspace, listWorkspaces, ping, updateWorkspace, dbConfigured } from './db.js'
import * as ai from './ai.js'
import {
  ARCHETYPES, GOALS, LEVERS, LEVER_KEYS, badges, evidence, extractFeedText, judgeCall, matchRowsToPosts, mirror, normaliseMetrics,
} from './pulse.js'

const app = express()
app.use(express.json({ limit: '4mb' }))

app.use(async (req, res, next) => {
  try {
    req.session = await readSession(req, res)
    req.ctx = { req, res, session: req.session }
    next()
  } catch (err) {
    next(err)
  }
})

app.use(express.static(path.join(import.meta.dirname, '..', 'public'), { extensions: ['html'] }))

app.use(['/api', '/auth', '/callback'], (_req, res, next) => {
  res.set('Cache-Control', 'no-store, private')
  next()
})

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}

/* ----------------------------------------------------------------- auth */
app.get('/auth/login', wrap(async (req, res) => {
  const unavailable = loginUnavailableReason(req.get('host'))
  if (unavailable) return res.redirect(`/?error=${encodeURIComponent(unavailable)}`)
  const { verifier, challenge } = createPkcePair()
  const state = createState()
  req.session.pkce = { codeVerifier: verifier, state }
  await req.session.save()
  res.redirect(buildAuthorizeUrl({ state, codeChallenge: challenge }))
}))

app.get('/callback', wrap(async (req, res) => {
  const { code, state, error, error_description: description } = req.query
  const pkce = req.session.pkce
  req.session.pkce = null
  if (error) {
    await req.session.save()
    return res.redirect(`/?error=${encodeURIComponent(description || error)}`)
  }
  if (!pkce) {
    await req.session.save()
    return res.redirect(`/?error=${encodeURIComponent('Your sign-in session was lost. Please connect again from this page.')}`)
  }
  if (state !== pkce.state) {
    await req.session.save()
    return res.status(403).send('Invalid state parameter: this callback did not come from a login this app started.')
  }
  try {
    req.session.tokens = await exchangeCodeForTokens({ code, codeVerifier: pkce.codeVerifier })
    const { account } = await graphql(req.ctx, ACCOUNT_QUERY)
    req.session.uid = account.id
    req.session.name = account.name || ''
    await req.session.save()
  } catch (err) {
    console.error(JSON.stringify({ event: 'oauth_callback_failed', code: err.oauthError, message: err.message }))
    req.session.tokens = null
    await req.session.save()
    return res.redirect(`/?error=${encodeURIComponent(withCause('Buffer could not complete the connection. Please try again.', err.message))}`)
  }
  const ws = await getWorkspace(req.session.uid)
  res.redirect(ws.onboarding ? '/app#mirror' : '/app#start')
}))

app.post('/auth/logout', wrap(async (req, res) => {
  await req.session.destroy()
  res.json({ connected: false })
}))

function requireUser(req) {
  if (!req.session.tokens || !req.session.uid) throw new HttpError(401, 'Connect your Buffer account first.')
  return req.session.uid
}

/* ----------------------------------------------------------- workspace */
// What the browser needs to draw every screen, derived fresh each time.
function view(ws) {
  const coded = ws.coded || []
  const m = coded.length ? mirror(coded) : null
  const goal = ws.onboarding?.goal || 'expert'
  const ev = ws.metrics ? evidence(coded.map((p) => ({ ...p, metrics: ws.metrics[p.id] })), goal) : null
  const experiments = (ws.experiments || []).map((e) => {
    const lift = e.postId && ev?.postLift ? ev.postLift[e.postId] ?? null : null
    return { ...e, lift, call: judgeCall(e.prediction, lift) }
  })
  const judged = experiments.filter((e) => e.lift != null)
  return {
    onboarding: ws.onboarding || null,
    mirror: m,
    topicCheck: ws.topicCheck || null,
    posts: coded.slice(0, 12),
    clusters: ws.clusters || [],
    sources: ws.sources || [],
    lastResearch: ws.lastResearch || null,
    brief: ws.brief || null,
    experiments,
    evidence: ev,
    evidenceSource: ws.metricsSource || null,
    calibration: judged.length ? { right: judged.filter((e) => e.call === 'Called it').length, of: judged.length } : null,
    badges: badges(ev),
    trending: ws.trending || [],
    ideas: ws.ideas || [],
  }
}

app.get('/api/me', wrap(async (req, res) => {
  const config = { login: !loginUnavailableReason(req.get('host')), ai: ai.aiConfigured(), aiName: ai.providerName(), db: dbConfigured() }
  if (!req.session.tokens || !req.session.uid) return res.json({ connected: false, config, redirectUri: REDIRECT_URI })
  const { account } = await graphql(req.ctx, ACCOUNT_QUERY)
  const ws = await getWorkspace(req.session.uid)
  res.json({
    connected: true, config,
    account: { name: account.name, organizations: account.organizations },
    workspace: view(ws),
    meta: { levers: LEVERS, archetypes: ARCHETYPES, goals: GOALS },
  })
}))

app.get('/api/channels', wrap(async (req, res) => {
  requireUser(req)
  const organizationId = req.query.organizationId
  if (!organizationId) throw new HttpError(400, 'organizationId is required')
  const data = await graphql(req.ctx, CHANNELS_QUERY, { organizationId })
  res.json({ channels: data.channels.filter((c) => !c.isDisconnected) })
}))

const clean = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

app.post('/api/onboarding', wrap(async (req, res) => {
  const uid = requireUser(req)
  const b = req.body || {}
  if (!b.organizationId || !b.channelId) throw new HttpError(400, 'Pick the LinkedIn channel Pulse should study.')
  const onboarding = {
    topic: clean(b.topic, 160), audiences: (b.audiences || []).map((a) => clean(a, 60)).slice(0, 10),
    goal: GOALS[b.goal] ? b.goal : 'expert', frequency: clean(b.frequency, 40), hunch: LEVERS[b.hunch] ? b.hunch : null,
    organizationId: clean(b.organizationId, 80), channelId: clean(b.channelId, 80), channelName: clean(b.channelName, 120),
    at: new Date().toISOString(),
  }
  const ws = await updateWorkspace(uid, (w) => {
    if (w.onboarding?.channelId && w.onboarding.channelId !== onboarding.channelId) { w.coded = []; w.metrics = null }
    w.onboarding = onboarding
  })
  res.json({ workspace: view(ws) })
}))

app.post('/api/audiences', wrap(async (req, res) => {
  requireUser(req)
  const topic = clean(req.body?.topic, 160)
  if (!topic) return res.json({ audiences: [] })
  const out = await ai.json(
    `A LinkedIn creator says they post about: "${topic}". Suggest 6 short audience labels (2 to 4 words each) of people most likely to read these posts. Plain, specific, no jargon.`,
    ai.S.obj({ audiences: ai.S.arr(ai.S.str()) }),
  )
  res.json({ audiences: (out.audiences || []).map((a) => clean(a, 40)).slice(0, 6) })
}))

/* --------------------------------------------------------------- mirror */
const codingSchema = ai.S.obj({
  posts: ai.S.arr(ai.S.obj({
    id: ai.S.str(),
    lever: ai.S.enumOf(LEVER_KEYS, 'the main persuasion lever'),
    secondary: ai.S.enumOf([...LEVER_KEYS, 'none'], 'a second lever, or none'),
    hook: ai.S.enumOf(['Number-led', 'Bold claim', 'Question', 'Story opening', 'How-to', 'Research citation', 'News or trend', 'Personal update', 'Other']),
    emotion: ai.S.enumOf(['Curiosity', 'Surprise', 'Inspiration', 'Anxiety', 'Frustration', 'Humour', 'Pride', 'Calm and informative']),
    why: ai.S.str('one sentence: which words in the post show the main lever'),
  })),
})

const codebookText = () => LEVER_KEYS.map((k) => `- ${k}: ${LEVERS[k].def}`).join('\n')

async function codePosts(posts) {
  const batches = []
  for (let i = 0; i < posts.length; i += 15) batches.push(posts.slice(i, i + 15))
  // Batches run in parallel so a 45-post history codes in one round trip.
  const results = await Promise.all(batches.map((batch) => ai.json(
    `You are a careful behavioural-science research assistant. Code each LinkedIn post using this codebook of persuasion levers:\n${codebookText()}\n\nFor each post choose the single main lever (what does most of the persuading), an optional secondary lever, the hook type of the opening line, and the dominant emotion. Base every choice only on the text.\n\nPosts:\n${batch.map((p) => `[${p.id}] ${clean(p.text, 600)}`).join('\n\n')}`,
    codingSchema, { temperature: 0.1 },
  ).then((out) => ({ batch, out })).catch((err) => ({ batch, err }))))
  const failures = results.filter((r) => r.err)
  if (failures.length === results.length) throw failures[0].err
  const coded = []
  for (const { batch, out } of results.filter((r) => !r.err)) {
    const byId = Object.fromEntries((out.posts || []).map((p) => [p.id, p]))
    for (const p of batch) {
      const c = byId[p.id]
      if (!c) continue
      coded.push({
        id: p.id, text: clean(p.text, 600), publishedAt: p.publishedAt,
        lever: c.lever, secondary: c.secondary === 'none' ? null : c.secondary, hook: c.hook, emotion: c.emotion, why: clean(c.why, 240),
      })
    }
  }
  return coded.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
}

app.post('/api/mirror', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const ob = ws.onboarding
  if (!ob) throw new HttpError(400, 'Finish the first questions before Pulse reads your posts.')
  const posts = (await fetchSentPosts((q) => graphql(req.ctx, q), { organizationId: ob.organizationId, channelId: ob.channelId, limit: 45 }))
    .filter((p) => p.text && p.text.trim().length > 20)
  if (posts.length < 5) {
    throw new HttpError(400, `Pulse found ${posts.length} sent posts with text on this channel. It needs at least 5 to see a pattern. Try again after a few more posts, or use the sample account to explore.`)
  }
  const checkPromise = ai.json(
    `A creator said they post about "${ob.topic}" for: ${ob.audiences.join(', ') || 'unspecified readers'}.\nHere are their recent posts:\n${posts.slice(0, 30).map((p) => '- ' + clean(p.text, 240)).join('\n')}\n\nSummarise in under 12 words what these posts are mostly about, count how many of the listed posts fit the stated topic, and say whether the stated topic matches.`,
    ai.S.obj({ summary: ai.S.str(), onTopic: ai.S.int(), matches: { type: 'BOOLEAN' } }),
    { temperature: 0.1 },
  ).catch(() => ({ summary: '', onTopic: 0, matches: true }))
  const [coded, check] = await Promise.all([codePosts(posts), checkPromise])
  const next = await updateWorkspace(uid, (w) => {
    w.coded = coded
    w.topicCheck = { summary: clean(check.summary, 120), onTopic: check.onTopic, of: Math.min(30, posts.length), matches: !!check.matches, resolved: null }
    w.mirroredAt = new Date().toISOString()
  })
  res.json({ workspace: view(next) })
}))

app.post('/api/topic-check', wrap(async (req, res) => {
  const uid = requireUser(req)
  const choice = req.body?.choice === 'posts' ? 'posts' : 'mine'
  const ws = await updateWorkspace(uid, (w) => {
    if (!w.topicCheck) return
    w.topicCheck.resolved = choice
    if (choice === 'posts' && w.onboarding) w.onboarding.topic = w.topicCheck.summary
  })
  res.json({ workspace: view(ws) })
}))

app.post('/api/posts/:id/lever', wrap(async (req, res) => {
  const uid = requireUser(req)
  const lever = req.body?.lever
  if (!LEVERS[lever]) throw new HttpError(400, 'Unknown lever')
  const ws = await updateWorkspace(uid, (w) => {
    const p = (w.coded || []).find((x) => x.id === req.params.id)
    if (p) { p.lever = lever; p.corrected = true }
  })
  res.json({ workspace: view(ws) })
}))

/* --------------------------------------------------------------- listen */
async function readSource(url) {
  let u
  try { u = new URL(url) } catch { throw new HttpError(400, `"${clean(url, 80)}" is not a valid link.`) }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new HttpError(400, 'Links must start with https://')
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)) throw new HttpError(400, 'That link is not public.')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': 'PulseResearchBot/1.0 (+Buffer Commit project)' } })
    if (!r.ok) return { url: u.toString(), ok: false, text: '' }
    const body = (await r.text()).slice(0, 400_000)
    return { url: u.toString(), ok: true, text: extractFeedText(body) }
  } catch {
    return { url: u.toString(), ok: false, text: '' }
  } finally {
    clearTimeout(t)
  }
}

const clusterSchema = ai.S.obj({
  clusters: ai.S.arr(ai.S.obj({
    title: ai.S.str('the pain point as a question in the audience\'s own voice'),
    count: ai.S.int('how many of the items express this'),
    emotion: ai.S.enumOf(['Frustration', 'Anxiety', 'Confusion', 'Curiosity', 'Aspiration', 'Comparison', 'Fear']),
    quotes: ai.S.arr(ai.S.str('a short verbatim phrase from the items, with any names removed')),
    angle: ai.S.str('a content angle for a post that answers this'),
    source: ai.S.str('where it came from: "Pasted text" or the source name'),
  })),
  trending: ai.S.arr(ai.S.obj({ title: ai.S.str(), note: ai.S.str() }), 'up to 2 topics that come up across several sources'),
})

// Reads sources plus pasted text and asks the AI for pain-point clusters.
async function runResearch(ws, pasted, urls) {
  const read = await Promise.all(urls.map(readSource))
  const sourceText = read.filter((r) => r.ok && r.text).map((r) => `SOURCE ${new URL(r.url).hostname}:\n${r.text}`).join('\n\n')
  if (!pasted.trim() && !sourceText) throw new HttpError(400, 'Paste some comments or questions, or add a source Pulse can read.')
  const prompt = `You are a research assistant helping a LinkedIn creator who posts about "${ws.onboarding?.topic || 'their field'}" for ${ws.onboarding?.audiences?.join(', ') || 'their audience'}.\nRead the material below and find the recurring pain points, questions and wants of that audience. Group them into at most 5 clusters ranked by how often they appear. Keep quotes verbatim but short, and remove names, emails and phone numbers. Ignore anything that is not about the audience's problems.\n\n${pasted ? `PASTED BY THE CREATOR:\n${pasted}\n\n` : ''}${sourceText}`
  const out = await ai.json(prompt, clusterSchema, { temperature: 0.2 })
  const clusters = (out.clusters || []).slice(0, 5).map((c) => ({
    title: clean(c.title, 140), count: c.count, emotion: c.emotion, quotes: (c.quotes || []).slice(0, 2).map((q) => clean(q, 160)),
    angle: clean(c.angle, 200), source: clean(c.source, 60),
  }))
  return {
    clusters, trending: (out.trending || []).slice(0, 2),
    sources: urls.map((u) => ({ url: u, ok: read.find((r) => r.url === new URL(u).toString())?.ok ?? false })),
    unreadable: read.filter((r) => !r.ok).map((r) => r.url),
  }
}

app.post('/api/listen', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const pasted = String(req.body?.text || '').slice(0, 20000)
  const urls = (req.body?.sources || ws.sources?.map((s) => s.url) || []).filter(Boolean).slice(0, 5)
  const r = await runResearch(ws, pasted, urls)
  const next = await updateWorkspace(uid, (w) => {
    w.clusters = r.clusters
    w.trending = r.trending
    w.sources = r.sources
    w.lastResearch = new Date().toISOString()
  })
  res.json({ workspace: view(next), trending: next.trending, unreadable: r.unreadable })
}))

// Weekly: refresh research for everyone who added sources. Called by Vercel Cron.
app.get('/api/cron/research', wrap(async (req, res) => {
  const secret = process.env.CRON_SECRET?.trim()
  const fromCron = secret ? req.get('authorization') === `Bearer ${secret}` : /vercel-cron/i.test(req.get('user-agent') || '')
  if (!fromCron) throw new HttpError(403, 'Not allowed')
  const started = Date.now()
  let refreshed = 0
  let failed = 0
  for (const u of await listWorkspaces()) {
    if (Date.now() - started > 45_000) break // stay inside the function time limit
    const urls = (u.data?.sources || []).map((s) => s.url).filter(Boolean)
    if (!urls.length || !u.data?.onboarding) continue
    try {
      const r = await runResearch(u.data, '', urls)
      await updateWorkspace(u.id, (w) => { w.clusters = r.clusters; w.trending = r.trending; w.sources = r.sources; w.lastResearch = new Date().toISOString() })
      refreshed += 1
    } catch (err) {
      failed += 1
      console.error(JSON.stringify({ event: 'cron_research_failed', message: err.message }))
    }
  }
  res.json({ refreshed, failed })
}))

app.post('/api/sources', wrap(async (req, res) => {
  const uid = requireUser(req)
  const urls = (req.body?.sources || []).map((u) => clean(u, 300)).filter(Boolean).slice(0, 5)
  const ws = await updateWorkspace(uid, (w) => { w.sources = urls.map((url) => ({ url, ok: null })) })
  res.json({ workspace: view(ws) })
}))

app.post('/api/ideas', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const c = ws.clusters?.[Number(req.body?.index)]
  if (!c || !ws.onboarding) throw new HttpError(400, 'Pick a pain point first.')
  const text = `${c.angle}\n\nWhat people said:\n${c.quotes.map((q) => `"${q}"`).join('\n')}\n\nFound by Pulse (${c.count} mentions, ${c.emotion.toLowerCase()}).`
  const result = (await graphql(req.ctx, createIdeaMutation({ organizationId: ws.onboarding.organizationId, title: c.title, text }))).createIdea
  if (!result?.id) throw new HttpError(400, withCause('Buffer could not save that idea.', result?.message))
  await updateWorkspace(uid, (w) => { w.clusters[Number(req.body.index)].ideaId = result.id })
  res.json({ ok: true, ideaId: result.id })
}))

/* ---------------------------------------------------------------- ideas */
app.post('/api/ideas/generate', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const v = view(ws)
  const levers = v.evidence?.levers?.length ? v.evidence.levers.map((l) => `${l.name}: ${l.verdict} (${l.lift}% over ${l.n} posts)`) : (v.mirror?.levers || []).map((l) => `${l.name}: used in ${Math.round(l.share * 100)}% of posts`)
  const out = await ai.json(
    `Suggest 5 fresh LinkedIn post ideas for a creator who posts about "${ws.onboarding?.topic}" for ${ws.onboarding?.audiences?.join(', ')}.\nTheir archetype: ${ARCHETYPES[v.mirror?.primary]?.name || 'unknown'}. Their levers so far: ${levers.join('; ') || 'not analysed yet'}.\nTheir audience's pain points: ${v.clusters.map((c) => c.title).join(' | ') || 'none collected yet'}.\nTrending in their sources: ${(ws.trending || []).map((t) => t.title).join(' | ') || 'none'}.\nMix it up: 2 ideas on their strongest lever, 2 that test an under-used lever, 1 conversation starter. Each idea needs a working title, a first line (hook) in their voice, the lever key from this list (${LEVER_KEYS.join(', ')}), and one sentence on why it fits. Never invent statistics.`,
    ai.S.obj({ ideas: ai.S.arr(ai.S.obj({ title: ai.S.str(), hook: ai.S.str(), lever: ai.S.enumOf(LEVER_KEYS), why: ai.S.str() })) }),
    { temperature: 0.8 },
  )
  const ideas = (out.ideas || []).slice(0, 5).map((i) => ({ title: clean(i.title, 120), hook: clean(i.hook, 200), lever: i.lever, why: clean(i.why, 200) }))
  await updateWorkspace(uid, (w) => { w.ideas = ideas })
  res.json({ ideas })
}))

app.post('/api/ideas/save', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const idea = req.body?.idea
  if (!idea?.title || !ws.onboarding) throw new HttpError(400, 'Pick an idea first.')
  const r = (await graphql(req.ctx, createIdeaMutation({ organizationId: ws.onboarding.organizationId, title: clean(idea.title, 120), text: `${clean(idea.hook, 300)}\n\nWhy: ${clean(idea.why, 300)}\n\nFrom Pulse (${LEVERS[idea.lever]?.name || 'idea'}).` }))).createIdea
  if (!r?.id) throw new HttpError(400, withCause('Buffer could not save that idea.', r?.message))
  res.json({ ok: true })
}))

/* ---------------------------------------------------------------- brief */
app.post('/api/brief', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const idea = req.body?.idea
  const c = idea?.title
    ? { title: clean(idea.title, 140), count: 0, emotion: 'Curiosity', quotes: [clean(idea.hook, 200)], angle: clean(idea.why, 200) }
    : ws.clusters?.[Number(req.body?.index)]
  if (!c) throw new HttpError(400, 'Pick a pain point or an idea first.')
  const v = view(ws)
  const proven = v.evidence?.levers?.find((l) => l.verdict === 'Works for you')
  const used = v.mirror?.levers?.[0]
  const testing = v.mirror?.shift?.to ? Object.keys(LEVERS).find((k) => LEVERS[k].archetype === v.mirror.shift.to) : null
  const main = (LEVERS[idea?.lever] && idea.lever) || proven?.key || used?.key || 'specificity'
  const mainWhy = proven ? `${LEVERS[main].name} is proven for this audience: ${proven.lift > 0 ? '+' : ''}${proven.lift}% over ${proven.n} posts.` : used ? `${LEVERS[main].name} is the lever this creator uses most (${Math.round(used.share * 100)}% of posts).` : 'Specificity is a strong default for expert content.'
  const voice = (ws.coded || []).slice(0, 6).map((p) => `- ${clean(p.text, 400)}`).join('\n')
  const second = testing && testing !== main ? testing : (main === 'contrarian' ? 'narrative' : 'contrarian')
  const out = await ai.json(
    `Write a short research brief and three LinkedIn post drafts for a creator who posts about "${ws.onboarding?.topic}" for ${ws.onboarding?.audiences?.join(', ')}.\n\nTopic: "${c.title}"${c.count ? ` (${c.count} audience mentions, emotion: ${c.emotion})` : ''}. Their words: ${c.quotes.join(' | ')}. Suggested angle: ${c.angle}.\n\nDraft 1 must use the lever "${LEVERS[main].name}" (${LEVERS[main].def}). Draft 2 must test "${LEVERS[second].name}" (${LEVERS[second].def}). Draft 3 must use "Reciprocity" (${LEVERS.reciprocity.def}).\nMatch the creator's voice from these real posts:\n${voice}\n\nRules: plain words, no hashtags walls, no emojis unless the creator uses them, under 1300 characters each, no invented statistics (use the audience's numbers or clearly personal ones).`,
    ai.S.obj({
      title: ai.S.str('brief title, under 12 words'),
      hypothesis: ai.S.str('one sentence prediction of what will happen and why'),
      drafts: ai.S.arr(ai.S.obj({ text: ai.S.str() })),
    }),
    { temperature: 0.7 },
  )
  const levers = [main, second, 'reciprocity']
  const brief = {
    index: idea ? null : Number(req.body.index), title: clean(out.title, 120), why: c.count ? `${c.count} mentions of "${c.title}"` : `Idea: ${c.title}`, leverWhy: mainWhy,
    hypothesis: clean(out.hypothesis, 240), metric: GOALS[ws.onboarding?.goal || 'expert'].metric,
    drafts: (out.drafts || []).slice(0, 3).map((d, i) => ({ lever: levers[i], text: String(d.text || '').trim().slice(0, 2800) })),
  }
  const next = await updateWorkspace(uid, (w) => { w.brief = brief })
  res.json({ workspace: view(next) })
}))

app.post('/api/experiments', wrap(async (req, res) => {
  const uid = requireUser(req)
  const ws = await getWorkspace(uid)
  const ob = ws.onboarding
  const { text, lever, prediction, mode } = req.body || {}
  if (!ob) throw new HttpError(400, 'Finish onboarding first.')
  if (!text?.trim()) throw new HttpError(400, 'The draft is empty.')
  if (!['yes', 'no'].includes(prediction)) throw new HttpError(400, 'Make your prediction first.')
  let postId = null
  let ideaId = null
  if (mode === 'idea') {
    const r = (await graphql(req.ctx, createIdeaMutation({ organizationId: ob.organizationId, title: ws.brief?.title || 'Pulse experiment', text: text.trim() }))).createIdea
    if (!r?.id) throw new HttpError(400, withCause('Buffer could not save that idea.', r?.message))
    ideaId = r.id
  } else {
    const channels = (await graphql(req.ctx, CHANNELS_QUERY, { organizationId: ob.organizationId })).channels
    const channel = channels.find((c) => c.id === ob.channelId && !c.isDisconnected)
    if (!channel) throw new HttpError(400, 'Your LinkedIn channel is not connected in Buffer right now.')
    const r = (await graphql(req.ctx, CREATE_POST, { input: buildPostInput({ channelId: channel.id, service: channel.service, text: text.trim(), draft: mode !== 'queue' }) })).createPost
    if (!r?.post) throw new HttpError(400, withCause('Buffer could not create that post.', r?.message))
    postId = r.post.id
  }
  const next = await updateWorkspace(uid, (w) => {
    w.experiments ||= []
    w.experiments.unshift({
      n: w.experiments.length + 1, title: w.brief?.title || 'Pulse experiment', lever: LEVERS[lever] ? lever : null,
      prediction, mode: mode || 'draft', postId, ideaId, text: clean(text, 300), at: new Date().toISOString(),
    })
  })
  res.json({ workspace: view(next) })
}))

/* ------------------------------------------------------------- evidence */
function rowsFromWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  let best = []
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null })
    const h = grid.findIndex((r) => r.some((c) => /date/i.test(String(c ?? ''))) && r.some((c) => /impression|engagement|reaction|comment|click/i.test(String(c ?? ''))))
    if (h < 0) continue
    const head = grid[h].map((c) => String(c ?? '').trim())
    const rows = grid.slice(h + 1).filter((r) => r.some((c) => c != null)).map((r) => Object.fromEntries(head.map((k, i) => [k || `col${i}`, r[i]])))
    if (rows.length > best.length) best = rows
  }
  return best
}

app.post('/api/evidence/upload', wrap(async (req, res) => {
  const uid = requireUser(req)
  const data = String(req.body?.data || '')
  if (!data) throw new HttpError(400, 'Choose your analytics file first.')
  const rows = rowsFromWorkbook(Buffer.from(data, 'base64'))
  if (!rows.length) throw new HttpError(400, 'Pulse could not find a table with dates and numbers in that file. Use the posts export from LinkedIn analytics.')
  const ws = await getWorkspace(uid)
  const matched = matchRowsToPosts(rows, ws.coded || [])
  if (!Object.keys(matched).length) throw new HttpError(400, 'None of the rows matched the dates of your Buffer posts. Check that the export covers the same period.')
  const next = await updateWorkspace(uid, (w) => { w.metrics = { ...(w.metrics || {}), ...matched }; w.metricsSource = { kind: 'upload', at: new Date().toISOString(), matched: Object.keys(matched).length } })
  res.json({ workspace: view(next) })
}))

app.post('/api/evidence/key', wrap(async (req, res) => {
  const uid = requireUser(req)
  const key = String(req.body?.key || '').trim()
  if (key.length < 10) throw new HttpError(400, 'Paste your Buffer personal key.')
  const ws = await getWorkspace(uid)
  const ob = ws.onboarding
  if (!ob) throw new HttpError(400, 'Finish onboarding first.')
  // The key is used for these calls only. It is never logged or saved.
  const posts = await fetchSentPosts((q) => graphqlWithKey(key, q), { organizationId: ob.organizationId, channelId: ob.channelId, limit: 100, withMetrics: true })
  const metrics = {}
  for (const p of posts) if (p.metrics?.length) metrics[p.id] = normaliseMetrics(p.metrics)
  if (!Object.keys(metrics).length) throw new HttpError(400, 'Buffer returned no numbers for these posts yet. New posts can take a day to show metrics.')
  const next = await updateWorkspace(uid, (w) => { w.metrics = { ...(w.metrics || {}), ...metrics }; w.metricsSource = { kind: 'key', at: new Date().toISOString(), matched: Object.keys(metrics).length } })
  res.json({ workspace: view(next) })
}))

/* ------------------------------------------------------------------ ask */
app.post('/api/ask', wrap(async (req, res) => {
  const uid = requireUser(req)
  const q = clean(req.body?.question, 500)
  if (!q) throw new HttpError(400, 'Ask a question first.')
  const v = view(await getWorkspace(uid))
  const context = {
    topic: v.onboarding?.topic, audiences: v.onboarding?.audiences, goal: v.onboarding?.goal,
    archetype: v.mirror?.primary, streak: v.mirror?.streak, leversUsed: v.mirror?.levers?.slice(0, 5),
    evidence: v.evidence?.enough ? v.evidence.levers : 'no results unlocked yet',
    painPoints: v.clusters.slice(0, 5).map((c) => c.title),
    experiments: v.experiments.slice(0, 5).map((e) => ({ title: e.title, lever: e.lever, prediction: e.prediction, lift: e.lift, call: e.call })),
  }
  const out = await ai.search(`You are Pip, the friendly research assistant inside Pulse, an app that helps LinkedIn creators learn which persuasion levers work for their audience. Answer the creator's question in under 140 words, plainly and honestly. Use their data below when the question is about them; use Google Search for anything about trends or the world, and never invent numbers. One post is never a pattern: say so when evidence is thin. End with one concrete next step.\n\nCreator data (JSON): ${JSON.stringify(context)}\n\nQuestion: ${q}`, { query: `${q} ${v.onboarding?.topic || ''}`.trim() })
  res.json({ answer: out.text, sources: out.sources })
}))

/* ---------------------------------------------------------- your data */
app.post('/api/delete', wrap(async (req, res) => {
  const uid = requireUser(req)
  await deleteWorkspace(uid)
  await req.session.destroy()
  res.json({ deleted: true })
}))

app.get('/api/health', wrap(async (_req, res) => {
  res.json({ ok: true, db: await ping(), ai: ai.providerName() })
}))

app.get('/app', (_req, res) => res.sendFile(path.join(import.meta.dirname, '..', 'public', 'app.html')))

app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err)
  console.error(JSON.stringify({ event: 'unhandled_request_error', name: err.name, message: err.message }))
  res.status(500).json({ error: withCause('Something went wrong. Please try again.', err.message) })
})

export default app
