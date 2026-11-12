/* Pulse app: one page, six screens, hash routing. All text from users or the AI
   is escaped before it touches the page. */
(function () {
  const A = window.PulseArt
  const SAMPLE = new URLSearchParams(location.search).has('sample')
  const view = document.getElementById('view')

  const LEVERS = {
    specificity: ['Specificity', 'librarian', 'Leads with exact numbers, named examples or precise detail.', 'Concrete detail makes ideas credible and memorable (Heath & Heath, Made to Stick)'],
    authority: ['Authority', 'librarian', 'Leans on expertise, research or named experts.', 'Cialdini, Influence: the principle of authority'],
    contrarian: ['Contrarian framing', 'spark', 'Challenges a common belief or default advice.', 'Surprise drives sharing (Berger & Milkman, 2012)'],
    curiosity_gap: ['Curiosity gap', 'spark', 'Opens a question the reader wants closed.', 'Loewenstein (1994): information-gap theory of curiosity'],
    narrative: ['Narrative', 'storyteller', 'Tells a story with a moment, a character and a turn.', 'Narrative transportation (Green & Brock, 2000)'],
    vulnerability: ['Vulnerability', 'storyteller', 'Shares a mistake, struggle or honest feeling.', 'High-arousal emotion predicts sharing (Berger & Milkman, 2012)'],
    utility: ['Utility', 'coach', 'Gives steps, frameworks or tips.', 'Practical value predicts sharing (Berger, Contagious)'],
    loss_framing: ['Loss framing', 'coach', 'Frames what the reader could lose or avoid.', 'Prospect theory (Kahneman & Tversky, 1979)'],
    reciprocity: ['Reciprocity', 'host', 'Gives first or invites replies.', 'Cialdini, Influence: reciprocity'],
    belonging: ['Belonging', 'host', 'Speaks to a shared identity.', 'Cialdini, Pre-Suasion: unity'],
    social_proof: ['Social proof', 'curator', 'Points to what many others do or recommend.', 'Cialdini, Influence: social proof'],
    novelty: ['Novelty', 'curator', 'Shares something new, a trend or a discovery.', 'Interest and surprise predict sharing (Berger & Milkman, 2012)'],
  }
  const ORDER = ['librarian', 'spark', 'storyteller', 'coach', 'host', 'curator']
  const GOALS = { expert: ['Be known as an expert', 'engagement rate'], conversations: ['Start conversations', 'comments'], reach: ['Reach more people', 'impressions'], enquiries: ['Get enquiries', 'clicks'] }
  const HUNCHES = [['specificity', 'Specific numbers'], ['contrarian', 'Bold opinions'], ['narrative', 'Personal stories'], ['utility', 'How-to tips'], ['reciprocity', 'Asking questions'], ['social_proof', "Sharing others' work"]]
  const FREQ = ['Less than once a week', '1 to 2 times a week', '3 to 4 times a week', 'Almost daily']

  let me = null
  let ws = null
  const ui = {
    busy: null, error: null, ob: null, listenTab: 'paste', paste: '', sourceDraft: null,
    draft: 0, draftText: null, prediction: null, mode: 'draft', sent: null, chat: [], deleteArmed: false,
  }

  /* ------------------------------------------------------------ helpers */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const lv = (k) => LEVERS[k] || ['Unknown', 'librarian', '', '']
  const archOf = (k) => A.FACES[k] || A.FACES.librarian
  const leverTag = (k) => `<span class="tag lever" style="background:${archOf(lv(k)[1]).color}" title="${esc(lv(k)[3])}">${esc(lv(k)[0])}</span>`
  const pct = (x) => Math.round((x || 0) * 100) + '%'
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + '%'
  const route = () => (location.hash || '#mirror').slice(1)

  function toast(msg) {
    const t = document.createElement('div')
    t.className = 'toast rise'
    t.setAttribute('role', 'status')
    t.textContent = msg
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 4200)
  }

  async function api(path, body) {
    const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (res.status === 401 && !SAMPLE) { location.href = '/?error=' + encodeURIComponent(json.error || 'Please connect your Buffer account again.'); throw new Error('signed out') }
    if (!res.ok) { const e = new Error(json.error || 'Something went wrong. Please try again.'); e.code = json.code; throw e }
    return json
  }

  async function run(key, fn) {
    if (ui.busy) return
    ui.busy = key
    ui.error = null
    render()
    try {
      await fn()
    } catch (e) {
      if (e.message !== 'signed out') { ui.error = e.message; toast(e.message) }
    } finally {
      ui.busy = null
      render()
    }
  }

  const loadingBtn = (key, label, cls = 'primary', act = key, extra = '') =>
    `<button class="btn ${cls}" data-act="${act}" ${extra} ${ui.busy ? 'disabled' : ''}>${ui.busy === key ? '<span class="loading"><i></i><i></i><i></i></span> Working' : label}</button>`

  const sampleOnly = () => { toast('This is the sample account. Connect your Buffer to do this with your own posts.'); return true }

  function aiLinks(prompt) {
    const q = encodeURIComponent(prompt)
    return `<a class="btn small" target="_blank" rel="noopener" href="https://claude.ai/new?q=${q}">Open in Claude</a><a class="btn small" target="_blank" rel="noopener" href="https://chatgpt.com/?q=${q}">Open in ChatGPT</a>`
  }
  function ideaPrompt(title, hook, lever) {
    const ob = ws?.onboarding || {}
    return `Help me develop a LinkedIn post. I write about ${ob.topic || 'my field'} for ${(ob.audiences || []).join(', ') || 'my audience'}. Idea: "${title}". Opening line: "${hook}". Persuasion lever to use: ${lv(lever)[0]} (${lv(lever)[2]}). Give me 3 versions under 1,300 characters, no invented statistics.`
  }

  /* ------------------------------------------------------------- chrome */
  function renderChrome() {
    document.querySelectorAll('#nav a').forEach((a) => {
      if (a.getAttribute('href').endsWith('#' + route())) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
    const who = document.getElementById('who')
    if (SAMPLE) {
      who.innerHTML = `<span class="badge-sample">Sample account · invented data</span><a class="btn dark small" style="color:#fff" href="/auth/login">Connect yours</a>`
    } else if (me?.connected) {
      who.innerHTML = `<span class="mono" style="font-size:12px">${esc(me.account?.name || 'You')}</span><button class="btn small" data-act="logout">Log out</button><button class="btn small" data-act="delete" style="${ui.deleteArmed ? 'border-color:#E8473B;color:#B3261E' : ''}">${ui.deleteArmed ? 'Click again to delete everything' : 'Delete my data'}</button>`
    }
  }

  /* ------------------------------------------------------------ screens */
  const pipSays = (text) => `<div style="display:flex;gap:14px;align-items:flex-end">${A.pip(80, 'Pip')}<div class="speech rise">${esc(text)}</div></div>`

  function renderStart() {
    const ob = (ui.ob ||= {
      step: 0, topic: ws?.onboarding?.topic || '', audiences: new Set(ws?.onboarding?.audiences || []), options: ws?.onboarding?.audiences || [],
      goal: ws?.onboarding?.goal || 'expert', frequency: ws?.onboarding?.frequency || FREQ[1], hunch: ws?.onboarding?.hunch || 'specificity',
      orgId: me?.account?.organizations?.[0]?.id || null, channels: null, channelId: null, own: '',
    })
    const says = [
      "Hi, I'm Pip! Five quick questions, then I'll read your posts and show you who you are as a creator.",
      'Based on your topic, these people might be reading. Not right? Add your own.',
      'Now the big one. What does a good post mean for you?',
      "Got it. Let's keep the pace realistic.",
      "Before I look at any data: what's your gut feeling?",
      'Last step. Which LinkedIn account should I study?',
    ]
    const chip = (on, act, i, label) => `<button class="chip" aria-pressed="${on}" data-act="${act}" data-i="${esc(i)}">${esc(label)}</button>`
    let body = ''
    if (ob.step === 0) {
      body = `<label for="topic"><h2>What do you post about?</h2></label>
        <input id="topic" data-model="topic" value="${esc(ob.topic)}" placeholder="e.g. Behavioural finance for young investors">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="muted" style="font-size:13px">Or try:</span>
        ${['Behavioural finance for young investors', 'B2B marketing for SaaS founders', 'Product design and UX research', 'Career advice for early professionals'].map((t, i) => chip(false, 'ob-topic', t, t.split(' for ')[0].split(' and ')[0])).join('')}</div>
        <p class="muted" style="font-size:13px">This steers which audience questions and trends Pulse pays attention to. Your next answers adapt to it.</p>`
    } else if (ob.step === 1) {
      body = `<h2>Who are you trying to reach?</h2>
        <div role="group" aria-label="Audience" style="display:flex;flex-wrap:wrap;gap:10px">${ob.options.map((a) => chip(ob.audiences.has(a), 'ob-aud', a, a)).join('')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><label class="sr" for="own">Add your own audience</label><input id="own" data-model="own" value="${esc(ob.own)}" placeholder="Not here? Add your own" style="flex:1 1 260px"><button class="btn" data-act="ob-own">Add</button></div>
        <p class="muted" style="font-size:13px">Pick as many as fit. Pulse double-checks these against your posts.</p>`
    } else if (ob.step === 2) {
      body = `<h2>What should your posts do for you?</h2><div class="grid" role="group" aria-label="Goal">${Object.entries(GOALS).map(([k, [label, metric]]) =>
        `<button class="chip" style="flex-direction:column;align-items:flex-start;padding:16px;border-radius:20px;min-height:84px" aria-pressed="${ob.goal === k}" data-act="ob-goal" data-i="${k}"><b style="font-family:var(--display);font-size:19px;font-weight:600">${esc(label)}</b><span class="mono muted" style="font-size:12px">We will measure: ${esc(metric)}</span></button>`).join('')}</div>`
    } else if (ob.step === 3) {
      body = `<h2>How often do you post on LinkedIn now?</h2><div role="group" aria-label="Frequency" style="display:flex;flex-wrap:wrap;gap:10px">${FREQ.map((f) => chip(ob.frequency === f, 'ob-freq', f, f)).join('')}</div>
        <p class="muted" style="font-size:13px">Pulse suggests one or two experiments a week, never more than you already post.</p>`
    } else if (ob.step === 4) {
      body = `<h2>Your hunch: which of these works best for you today?</h2><div role="group" aria-label="Hunch" style="display:flex;flex-wrap:wrap;gap:10px">${HUNCHES.map(([k, l]) => chip(ob.hunch === k, 'ob-hunch', k, l)).join('')}</div>
        <p class="muted" style="font-size:13px">Your first prediction. Pulse will tell you later if your gut was right.</p>`
    } else {
      const orgs = me?.account?.organizations || []
      body = `<h2>Which LinkedIn account should Pulse study?</h2>
        ${orgs.length > 1 ? `<label for="org">Buffer organization</label><select id="org" data-model="orgId">${orgs.map((o) => `<option value="${esc(o.id)}" ${o.id === ob.orgId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}
        ${ob.channels === null ? '<p class="muted"><span class="loading"><i></i><i></i><i></i></span> Loading your channels…</p>'
          : ob.channels.length ? `<div class="stack" role="radiogroup" aria-label="Channel">${ob.channels.map((c) => {
            const ok = c.service === 'linkedin'
            return `<button class="chip" role="radio" aria-checked="${ob.channelId === c.id}" aria-pressed="${ob.channelId === c.id}" data-act="ob-channel" data-i="${esc(c.id)}" ${ok ? '' : 'disabled'} style="justify-content:space-between;border-radius:16px;min-height:56px"><span>${esc(c.displayName || c.name)} · ${esc(c.service)}</span><span class="muted" style="font-size:13px">${ok ? '' : 'coming after the MVP'}</span></button>`
          }).join('')}</div>` : '<p class="err">No connected channels found in this organization. Connect LinkedIn in Buffer first, then reload.</p>'}`
    }
    const last = ob.step === 5
    return `<div style="max-width:820px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:22px">
      <div style="display:flex;align-items:center;gap:14px"><div class="bar" style="flex:1;height:10px"><i style="width:${((ob.step + 1) / 6) * 100}%;background:var(--bright);transition:width .5s"></i></div><span class="mono" style="font-weight:700;font-size:13px">${ob.step + 1} / 6</span></div>
      ${pipSays(says[ob.step])}
      <section class="card rise" style="gap:16px">${body}
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:6px">
          <button class="btn" data-act="ob-back" ${ob.step === 0 ? 'disabled' : ''}>Back</button>
          ${last ? loadingBtn('ob-finish', 'Read my posts', 'primary') : loadingBtn('ob-next', 'Next', 'dark')}
        </div>
      </section></div>`
  }

  function needProfile() {
    return `<section class="card soft" style="align-items:flex-start">${A.pip(70)}<h2>First, tell Pip a little about you</h2><p class="muted">Five quick questions, then Pulse reads your posts.</p><a class="btn primary" href="#start">Start</a></section>`
  }

  function collection() {
    const b = ws.badges || {}
    const m = ws.mirror
    return `<section class="stack"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline"><h2 style="font-size:32px">Your archetype collection</h2><span class="mono" style="font-size:13px">A badge fills in as experiments prove a lever</span></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,170px),1fr))">${ORDER.map((k, i) => {
        const f = archOf(k)
        const st = m?.primary === k ? ['Your archetype', 'var(--bright)'] : m?.streak === k ? ['Emerging', 'var(--subtle)'] : ['Locked', 'var(--soft)']
        const n = b[k] || 0
        return `<article class="card tight rise d${(i % 5) + 1}" style="gap:8px"><div style="display:flex;justify-content:space-between;align-items:flex-start">${A.face(k, 68, i % 2 ? 'bob2' : 'bob')}<span class="tag" style="background:${st[1]}">${st[0]}</span></div><b style="font-family:var(--display);font-weight:600;font-size:18px">${esc(f.name)}</b>
          <div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;gap:4px;align-items:center">${Array.from({ length: 6 }, (_, j) => j < n ? `<span class="pop" style="width:16px;height:16px;border-radius:50%;background:${f.color};animation-delay:${0.5 + j * 0.12}s"></span>` : '<span style="width:12px;height:12px;border-radius:50%;border:2px dashed #B9B4C9"></span>').join('')}</div><span class="mono" style="font-size:12px;font-weight:700">0${n}/06</span></div></article>`
      }).join('')}</div></section>`
  }

  function renderMirror() {
    if (!ws?.onboarding) return needProfile()
    const m = ws.mirror
    if (!m) {
      return `<section class="card soft" style="align-items:flex-start;gap:14px">${A.pip(90, 'Pip')}<span class="eyebrow">Step 1 · Mirror</span><h1>Ready when you are.</h1>
        <p class="muted" style="max-width:640px">Pulse will read up to 45 posts you've sent on ${esc(ws.onboarding.channelName || 'your LinkedIn')}, code each one like a researcher and work out your creator archetype. It takes about a minute.</p>
        ${ui.needPaste ? `<div class="card tight" style="width:100%;gap:10px"><b>${esc(ui.fewMsg || 'Paste a few of your recent LinkedIn posts.')}</b>
          <label class="sr" for="pp">Your recent LinkedIn posts</label><textarea id="pp" data-model="pastePosts" rows="8" placeholder="Paste 5 or more of your recent LinkedIn posts. Leave a blank line between posts.">${esc(ui.pastePosts || '')}</textarea>
          <span class="muted" style="font-size:13px">Copy them from your LinkedIn profile → Activity → Posts. Pulse only reads the text.</span></div>` : ''}
        ${loadingBtn('mirror', ui.needPaste ? 'Read these posts' : 'Read my posts')}</section>`
    }
    if (!m.enough) return `<section class="card soft">${A.pip(70)}<h2>Not enough posts yet</h2><p class="muted">Pulse found ${m.count} posts. It needs at least 5 to see a pattern.</p>${loadingBtn('mirror', 'Try again', 'dark')}</section>`
    const p = archOf(m.primary)
    const tc = ws.topicCheck
    const topicCard = tc && !tc.resolved && !tc.matches ? `<section class="card warm rise"><h2>Quick check: your answers and your posts differ</h2><p>You said you post about "${esc(ws.onboarding.topic)}", but ${tc.onTopic} of your last ${tc.of} posts fit it. Most are about <b>${esc(tc.summary)}</b>. Which should Pulse focus on?</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px"><button class="btn dark" data-act="topic" data-i="posts">Focus on what I post</button><button class="btn" data-act="topic" data-i="mine">Keep my answer: I'm shifting topics</button><a class="btn ghost" href="#start">Edit my answers</a></div></section>` : ''
    const shift = m.shift ? `<section class="card warm rise d3" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:20px">
      <div style="display:flex;align-items:center;gap:4px">${A.face(m.shift.from, 60)}<span class="mono" style="font-size:22px;font-weight:700">→</span>${A.face(m.shift.to, 60, 'bob2')}</div>
      <div class="stack" style="flex:1 1 380px;gap:6px"><h2>Something's shifting</h2><p class="muted">${m.shift.recentCount} of your last ${m.shift.recentOf} posts lean like ${esc(archOf(m.shift.to).name)}. Worth testing, not guessing.</p></div>
      <a class="btn primary" href="#ideas" data-act="test-shift">Test it</a></section>` : ''
    return `${topicCard}
      <section class="row" style="align-items:stretch">
        <div class="card soft rise" style="flex:1 1 520px;flex-direction:row;flex-wrap:wrap;align-items:center;gap:26px">${A.face(m.primary, 190, 'bob', true)}
          <div class="stack" style="flex:1 1 260px;gap:10px"><span class="eyebrow">Step 1 · Mirror · last ${m.analysed} posts</span><h1>You post like ${esc(p.name)}.</h1><p style="font-size:17px">${esc(p.line)}</p>
          ${m.streak ? `<div style="display:flex;align-items:center;gap:10px">${A.face(m.streak, 44, 'bob2')}<b>with a streak of ${esc(archOf(m.streak).name)}</b></div>` : ''}
          ${ws.onboarding.hunch ? `<p class="muted" style="font-size:13px">Your hunch was "${esc(lv(ws.onboarding.hunch)[0])}". ${m.levers[0]?.key === ws.onboarding.hunch ? 'Your posts agree.' : `Your posts lean most on ${esc(m.levers[0]?.name)}.`}</p>` : ''}</div></div>
        <div class="card rise d2" style="flex:1 1 340px"><h2>Levers you lean on</h2>${m.levers.slice(0, 6).map((l, i) => `<div class="stack" style="gap:6px"><div style="display:flex;justify-content:space-between;font-weight:500"><span title="${esc(lv(l.key)[3])}">${esc(l.name)}</span><span class="mono" style="font-weight:700">${pct(l.share)}</span></div><div class="bar"><i class="grow" style="width:${Math.min(100, l.share * 200)}%;background:${archOf(l.archetype).color};animation-delay:${0.2 + i * 0.1}s"></i></div></div>`).join('')}
          <p class="muted" style="font-size:13px">Share of your last ${m.analysed} posts. No performance numbers needed.</p></div>
      </section>
      ${shift}
      ${collection()}
      <section class="card"><h2>Recent posts, coded</h2><p class="muted" style="font-size:13px">Disagree with a label? Change it. Pulse learns from your corrections.</p>
        ${(ws.posts || []).map((post) => `<div class="card tight" style="background:var(--paper);gap:8px"><div>${esc(post.text)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">${leverTag(post.lever)}<span class="tag">${esc(post.hook)}</span><span class="tag grey">${esc(post.emotion)}</span>
          ${SAMPLE ? '' : `<label class="sr" for="lv-${esc(post.id)}">Change lever</label><select id="lv-${esc(post.id)}" data-change="lever" data-i="${esc(post.id)}" style="width:auto;min-height:36px;font-size:13px;margin-left:auto">${Object.entries(LEVERS).map(([k, v]) => `<option value="${k}" ${k === post.lever ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select>`}</div>
          <p class="muted" style="font-size:13px">Why: ${esc(post.why)} <span title="${esc(lv(post.lever)[3])}" style="text-decoration:underline dotted">Research basis</span></p></div>`).join('')}
      </section>
      <div style="display:flex;justify-content:flex-end"><a class="btn dark wiggle" href="#listen" style="color:#fff">Next: listen to your audience</a></div>`
  }

  function clusterCards() {
    if (!ws.clusters?.length) return ''
    return `<section class="stack"><h2 style="font-size:32px">${ws.clusters.length} pain points, ranked</h2>${ws.clusters.map((c, i) => `
      <article class="card rise" style="flex-direction:row;flex-wrap:wrap;gap:20px;align-items:center">
        <div style="width:84px;height:84px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${['#C9D5FF', '#FFE9A8', '#FBD1E6', '#C4F0DA', '#DCD1FF'][i % 5]}"><b style="font-family:var(--display);font-size:32px;line-height:1">${esc(c.count)}</b><span class="mono" style="font-size:11px">mentions</span></div>
        <div class="stack" style="flex:1 1 380px;gap:6px"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><h3>${esc(c.title)}</h3><span class="tag warm">${esc(c.emotion)}</span><span class="tag">${esc(c.source)}</span></div>
          ${(c.quotes || []).map((q) => `<div class="muted" style="font-style:italic">"${esc(q)}"</div>`).join('')}<div><b>Angle:</b> ${esc(c.angle)}</div></div>
        <div class="stack" style="gap:8px">${loadingBtn('brief-' + i, 'Write a brief', 'dark', 'brief-cluster', `data-i="${i}"`)}<button class="btn" data-act="save-cluster" data-i="${i}" ${c.ideaId ? 'disabled' : ''}>${c.ideaId ? 'Saved to Buffer Ideas' : 'Save to Buffer Ideas'}</button></div>
      </article>`).join('')}</section>`
  }

  function renderListen() {
    if (!ws?.onboarding) return needProfile()
    const tab = ui.listenTab
    const sources = ui.sourceDraft ?? (ws.sources || []).map((s) => s.url)
    const trending = ws.trending?.length ? `<div class="card soft" style="flex:1 1 300px"><div style="display:flex;align-items:center;gap:10px">${A.pip(48)}<h2>Trending in your sources</h2></div>${ws.trending.map((t) => `<div class="card tight"><b>${esc(t.title)}</b><span class="muted" style="font-size:13px">${esc(t.note)}</span></div>`).join('')}<a href="#ask">Ask Pulse about a trend</a></div>` : ''
    return `<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end;justify-content:space-between">
        <div class="stack" style="max-width:700px;gap:8px"><span class="eyebrow">Step 2 · Listen</span><h1 class="rise">What is your audience actually asking?</h1><p class="muted rise d1" style="font-size:17px">Paste what people say, or let Pulse read the newsletters and blogs your audience reads. You get their problems, in their words.</p></div>
        <div role="tablist" aria-label="Sources" style="display:flex;gap:8px"><button class="chip" role="tab" aria-selected="${tab === 'paste'}" aria-pressed="${tab === 'paste'}" data-act="tab" data-i="paste">Paste</button><button class="chip" role="tab" aria-selected="${tab === 'sources'}" aria-pressed="${tab === 'sources'}" data-act="tab" data-i="sources">My sources</button></div></div>
      ${tab === 'paste' ? `<section class="card rise"><label for="paste"><h2>Comments, questions, reviews or DMs</h2></label>
          <textarea id="paste" data-model="paste" placeholder="Paste the comments on your recent posts, reader replies, reviews or customer questions. One per line works best.">${esc(ui.paste)}</textarea>
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">${loadingBtn('listen', 'Find pain points')}<span class="muted" style="font-size:13px">Names, emails and phone numbers are left out of the results.</span></div></section>`
        : `<section class="row"><div class="card rise" style="flex:2 1 520px"><h2>Sources Pulse reads for you</h2><p class="muted" style="font-size:13px">Newsletter or blog feeds and public pages your audience reads. Up to 5. Run it whenever you want fresh research.</p>
          ${[0, 1, 2, 3, 4].map((i) => `<label class="sr" for="src${i}">Source ${i + 1}</label><input id="src${i}" type="url" data-src="${i}" value="${esc(sources[i] || '')}" placeholder="https://example.com/feed">`).join('')}
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">${loadingBtn('research', 'Run research now')}<span class="muted" style="font-size:13px">${ws.lastResearch ? 'Last run: ' + new Date(ws.lastResearch).toLocaleString() : 'Not run yet'}</span></div></div>${trending}</section>`}
      ${clusterCards()}`
  }

  function briefSection() {
    const b = ws.brief
    if (!b) return `<section class="card soft" style="align-items:flex-start">${A.pip(64)}<h2>Pick something to write about</h2><p class="muted">Choose an idea above, or a pain point in Listen, and Pulse will write a research brief with three drafts.</p><a class="btn" href="#listen">Go to Listen</a></section>`
    const d = b.drafts[ui.draft] || b.drafts[0]
    const text = ui.draftText ?? d?.text ?? ''
    const sent = ui.sent
    return `<section class="stack" id="brief"><span class="eyebrow">Research brief</span><h1 class="rise" style="font-size:clamp(32px,4vw,46px)">${esc(b.title)}</h1>
      <div class="grid rise d1">${[['Why this topic', b.why], ['Why this lever', b.leverWhy], ['Hypothesis', b.hypothesis], ["How we'll know", `${b.metric} after 7 days, against your usual post.`]].map(([h, t]) => `<div class="card tight cut"><span class="eyebrow">${h}</span><div>${esc(t)}</div></div>`).join('')}</div>
      <h2 style="font-size:28px">Pick a draft</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))">${b.drafts.map((x, i) => `<button class="card tight" data-act="pick-draft" data-i="${i}" aria-pressed="${i === ui.draft}" style="text-align:left;border:3px solid ${i === ui.draft ? 'var(--bright)' : 'var(--line)'};transform:${i === ui.draft ? 'translateY(-4px)' : 'none'};transition:transform .25s;color:var(--ink)">${leverTag(x.lever)}<span style="white-space:pre-line">${esc(x.text)}</span></button>`).join('')}</div>
      <section class="card"><label for="draftText"><h3>Edit before it goes to your Buffer</h3></label><textarea id="draftText" data-model="draftText" style="font-family:var(--body);font-size:15px;min-height:180px">${esc(text)}</textarea>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="mono muted" style="font-size:12px">${text.length} / 3000 characters</span><span style="flex:1"></span>${aiLinks(`Improve this LinkedIn draft without changing its meaning. Keep it under 1,300 characters and do not invent statistics.\n\n${text}`)}</div></section>
      <section class="row">
        <div class="card soft"><div style="display:flex;align-items:center;gap:12px">${A.pip(60)}<div><span class="eyebrow">Prediction moment</span><h2>Will this beat your usual?</h2></div></div>
          <div role="group" aria-label="Prediction" style="display:flex;gap:12px">${['yes', 'no'].map((v) => `<button class="btn" data-act="predict" data-i="${v}" aria-pressed="${ui.prediction === v}" style="flex:1;min-height:62px;font-family:var(--display);font-size:26px;border-width:3px;background:${ui.prediction === v ? (v === 'yes' ? 'var(--bright)' : '#C9D5FF') : '#fff'}">${v === 'yes' ? 'Yes' : 'No'}</button>`).join('')}</div>
          <p class="muted" style="font-size:13px">Writing it down now stops hindsight from rewriting it later.</p></div>
        <div class="card"><h2>Save to your Buffer as</h2><div role="group" aria-label="Save as" style="display:flex;flex-wrap:wrap;gap:8px">${[['draft', 'A draft'], ['queue', 'Next in queue'], ['idea', 'An Idea']].map(([k, l]) => `<button class="chip" data-act="mode" data-i="${k}" aria-pressed="${ui.mode === k}">${l}</button>`).join('')}</div>
          ${ui.mode === 'queue' ? '<p class="muted" style="font-size:13px">This schedules it in your next free slot for real.</p>' : ''}
          ${sent ? `<div class="pop card tight" style="background:var(--good-soft);border:2px solid #2FB57C;flex-direction:row;align-items:center;gap:12px">${A.pip(52)}<div class="stack" style="gap:2px;flex:1"><b>Saved to your Buffer. Experiment ${esc(sent.n)} is live.</b><span style="font-size:13px">You predicted ${sent.prediction === 'yes' ? 'it will beat' : 'it will not beat'} your usual. Pulse checks once results are in.</span></div><a class="btn dark small" style="color:#fff" href="#evidence">See Evidence</a></div>`
            : `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">${loadingBtn('send', 'Send to my Buffer', 'primary wiggle')}<span class="muted" style="font-size:13px">${ui.prediction ? 'Pulse remembers which post belongs to this experiment.' : 'Make your prediction first.'}</span></div>`}
        </div></section></section>`
  }

  function renderIdeas() {
    if (!ws?.onboarding) return needProfile()
    const ideas = ws.ideas || []
    return `<div class="stack" style="gap:8px;max-width:760px"><span class="eyebrow">Step 3 · Ideas &amp; drafts</span><h1>Fresh ideas, built from your research.</h1><p class="muted" style="font-size:17px">Pulse mixes your strongest levers, your audience's pain points and what's trending in your sources.</p></div>
      <section class="card"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center"><h2>Post ideas</h2>${loadingBtn('ideas', ideas.length ? 'Get 5 new ideas' : 'Get 5 post ideas', 'primary')}</div>
        ${ideas.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))">${ideas.map((idea, i) => `<article class="card tight rise d${(i % 5) + 1}" style="background:var(--paper)">${leverTag(idea.lever)}<h3>${esc(idea.title)}</h3><p>"${esc(idea.hook)}"</p><p class="muted" style="font-size:13px">${esc(idea.why)}</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${loadingBtn('brief-idea-' + i, 'Write a brief', 'dark small', 'brief-idea', `data-i="${i}" style="color:#fff"`)}<button class="btn small" data-act="save-idea" data-i="${i}">Save to Buffer Ideas</button>${aiLinks(ideaPrompt(idea.title, idea.hook, idea.lever))}</div></article>`).join('')}</div>`
          : '<p class="muted">No ideas yet. Click the button and Pip will suggest five, based on everything Pulse knows about you and your audience.</p>'}
      </section>
      ${briefSection()}`
  }

  function renderEvidence() {
    if (!ws?.onboarding) return needProfile()
    const ev = ws.evidence
    if (!ws.mirror?.enough) return `<section class="card soft">${A.pip(64)}<h2>Run Mirror first</h2><p class="muted">Pulse needs your coded posts before it can match results to them.</p><a class="btn" href="#mirror">Go to Mirror</a></section>`
    const unlock = `<section class="row">
        <article class="card"><span class="tag good" style="align-self:flex-start">Most private</span><h2>Upload your LinkedIn analytics</h2>
          <ol class="muted" style="margin:0;padding-left:20px"><li>In LinkedIn, open your analytics and export your post data.</li><li>Choose the file here. Pulse reads only that file.</li><li>Repeat whenever you want fresh results.</li></ol>
          <label for="file">Analytics file (.xlsx or .csv)</label><input id="file" type="file" accept=".xlsx,.xls,.csv" style="min-height:auto;padding:12px">
          ${loadingBtn('upload', 'Read my file')}</article>
        <article class="card"><span class="tag" style="align-self:flex-start">Quickest</span><h2>Use a Buffer personal key</h2>
          <p class="muted">Create a key in your Buffer settings and paste it here. Pulse uses it once to read your post numbers, then throws it away. It never posts, edits or deletes.</p>
          <label for="pkey">Buffer personal key</label><input id="pkey" type="password" autocomplete="off" placeholder="Paste your key">
          ${loadingBtn('key', 'Read my numbers', 'dark')}</article></section>`
    if (!ev?.enough) {
      return `<div class="stack" style="gap:8px;max-width:820px"><span class="eyebrow">Step 4 · Evidence</span><h1>Unlock your results</h1><p class="muted" style="font-size:17px">Performance numbers aren't shared with outside apps by default, so you bring your own. Pick the way that feels right. Everything else in Pulse keeps working either way.</p></div>
        ${ev && !ev.enough ? `<p class="err">Pulse matched numbers to ${ev.measured} posts. It needs at least 3 to compare against your usual.</p>` : ''}${unlock}${experimentsCard()}`
    }
    const best = ev.levers.find((l) => l.verdict === 'Works for you')
    const worst = [...ev.levers].reverse().find((l) => l.lift < 0)
    const early = ev.levers.find((l) => l.verdict === 'Early signal' && l.lift > 0)
    const max = Math.max(10, ...ev.levers.map((l) => Math.abs(l.lift)))
    return `<div class="stack" style="gap:8px;max-width:860px"><span class="eyebrow">Step 4 · Evidence · ${esc(ev.metric)} across ${ev.measured} posts</span><h1>${best ? `${esc(best.name)} works for you.` : 'No lever stands out yet.'}${early ? ` ${esc(early.name)} isn't proven yet.` : ''}</h1></div>
      ${best ? `<section class="card warm pop" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:20px">${A.face(best.archetype, 92)}<div class="stack" style="flex:1 1 360px;gap:4px"><span class="eyebrow">Badge earned</span><h2>${esc(best.name)} is proven for your audience.</h2><p class="muted">${signed(best.lift)} ${esc(ev.metric)} over ${best.n} posts, compared with your usual.</p></div></section>` : ''}
      <section class="grid">
        <div class="card tight"><span class="tag good" style="align-self:flex-start">What worked</span><div>${best ? `${esc(best.name)}: <b>${signed(best.lift)}</b> over your usual, across ${best.n} posts.` : 'Nothing clearly above your usual yet.'}</div></div>
        <div class="card tight"><span class="tag warm" style="align-self:flex-start">What drifted</span><div>${worst ? `${esc(worst.name)}: <b>${signed(worst.lift)}</b> versus your usual, across ${worst.n} posts.` : 'Nothing clearly below your usual.'}</div></div>
        <div class="card tight soft"><span class="tag" style="align-self:flex-start;background:#fff">Try next</span><div>${early ? `${esc(early.name)} looks promising (${signed(early.lift)}) but rests on ${early.n} posts. Run 2 more before calling it.` : 'Pick an under-used lever from Ideas and test it.'}</div></div>
      </section>
      <section class="card" style="gap:4px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline"><h2>Which levers work for your audience</h2><span class="mono muted" style="font-size:12px">lift vs your median · posts</span></div>
        ${ev.levers.map((l, i) => {
          const w = (Math.abs(l.lift) / max) * 100
          const col = archOf(l.archetype).color
          const tg = { 'Works for you': 'good', 'Early signal': 'warm', 'No clear effect': 'grey', 'Works against you': 'bad' }[l.verdict]
          return `<div class="lift"><b title="${esc(lv(l.key)[3])}">${esc(l.name)}</b><div class="axis"><div>${l.lift < 0 ? `<i class="grow left" style="display:block;height:16px;width:${w}%;border-radius:999px 0 0 999px;background:${col};opacity:.55;animation-delay:${0.2 + i * 0.1}s"></i>` : ''}</div><span class="zero"></span><div>${l.lift >= 0 ? `<i class="grow" style="display:block;height:16px;width:${w}%;border-radius:0 999px 999px 0;background:${col};opacity:${l.verdict === 'Works for you' ? 1 : 0.55};animation-delay:${0.2 + i * 0.1}s"></i>` : ''}</div></div><span class="mono" style="font-weight:700">${signed(l.lift)} <span class="muted" style="font-weight:400">· ${l.n}</span></span><span class="tag ${tg}" style="justify-self:start">${esc(l.verdict)}</span></div>`
        }).join('')}
        <p class="muted" style="font-size:13px;margin-top:6px">Fewer than 5 posts is only an early signal. Results from ${ws.evidenceSource?.kind === 'key' ? 'a one-time Buffer key read' : 'your uploaded file'}, ${ws.evidenceSource?.matched || ev.measured} posts matched.</p></section>
      <section class="row">${experimentsCard()}${ws.calibration ? `<div class="card soft" style="align-items:center;text-align:center;flex:1 1 260px"><span class="eyebrow">Calibration</span>
        <svg width="150" height="150" viewBox="0 0 120 120" role="img" aria-label="Calibration: ${ws.calibration.right} of ${ws.calibration.of} calls right"><circle cx="60" cy="60" r="48" fill="none" stroke="#fff" stroke-width="14"></circle><circle cx="60" cy="60" r="48" fill="none" stroke="#FF6B3D" stroke-width="14" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="${(ws.calibration.right / ws.calibration.of) * 301.6} 302"></circle><text x="60" y="67" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="24" fill="#262335">${ws.calibration.right} / ${ws.calibration.of}</text></svg>
        <div>of your calls were right.</div></div>` : ''}</section>
      <details class="card"><summary style="cursor:pointer;font-weight:700">Refresh your results</summary>${unlock}</details>`
  }

  function experimentsCard() {
    const ex = ws.experiments || []
    if (!ex.length) return ''
    const bg = { 'Called it': 'good', Missed: 'bad', Underestimated: 'warm', 'Waiting for results': 'grey' }
    return `<div class="card" style="flex:2 1 480px"><h2>Your calls vs what happened</h2>${ex.slice(0, 8).map((e) => `<div class="card tight" style="background:var(--paper);flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px"><div class="stack" style="gap:2px"><b>Exp ${esc(e.n)} · ${esc(e.title)}</b><span class="muted" style="font-size:13px">You said: ${e.prediction === 'yes' ? 'Yes' : 'No'} · Result: ${e.lift == null ? 'waiting' : signed(e.lift)}${e.lever ? ' · ' + esc(lv(e.lever)[0]) : ''}</span></div><span class="tag ${bg[e.call] || 'grey'}">${esc(e.call)}</span></div>`).join('')}</div>`
  }

  function renderAsk() {
    if (!ws?.onboarding) return needProfile()
    const prompts = [['trend', "What's trending in my niche this week?"], ['why', 'Why did my best post do so well?'], ['next', 'What should I test next?'], ['stop', 'Which lever should I stop leaning on?']]
    const msgs = ui.chat.length ? ui.chat : [{ who: 'pip', text: `Hi! I've read your posts${ws.clusters?.length ? ' and your audience research' : ''}. Ask me about your content, your results or what's trending around ${ws.onboarding.topic}.` }]
    return `<section class="row" style="align-items:flex-start">
      <aside class="stack" style="flex:1 1 280px"><div class="card soft" style="align-items:flex-start">${A.pip(80, 'Pip')}<h1 style="font-size:34px">Ask Pulse</h1><p class="muted">Ask about your posts, your results or trends in your niche. Pip answers from your data and a live web search, and shows sources.</p></div>
        <div class="card tight"><span class="eyebrow">Try asking</span>${prompts.map(([k, q]) => `<button class="btn" style="justify-content:flex-start;text-align:left;font-weight:500;border-width:1px;border-color:var(--line)" data-act="ask-prompt" data-i="${k}">${esc(q)}</button>`).join('')}</div></aside>
      <section class="card" aria-label="Conversation" style="flex:3 1 560px;min-height:600px">
        <div class="stack" style="flex:1">${msgs.map((m) => m.who === 'pip'
          ? `<div class="rise" style="display:flex;gap:10px;align-items:flex-start">${A.pip(40)}<div class="bubble-pip" style="max-width:80%"><div style="white-space:pre-line">${esc(m.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1<i>$2</i>')}</div>${m.sources?.length ? `<div class="mono" style="font-size:12px;margin-top:8px">Sources: ${m.sources.map((s) => s.url && s.url !== '#' ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)).join(' · ')}</div>` : ''}</div></div>`
          : `<div class="bubble-you rise" style="max-width:80%">${esc(m.text)}</div>`).join('')}
          ${ui.busy === 'ask' ? `<div style="display:flex;gap:10px;align-items:center">${A.pip(40)}<span class="loading"><i></i><i></i><i></i></span></div>` : ''}</div>
        <form data-form="ask" style="display:flex;gap:10px;border-top:1px solid var(--soft);padding-top:14px"><label class="sr" for="q">Ask Pulse a question</label><input id="q" name="q" placeholder="Ask about your posts, results or trends" autocomplete="off" style="flex:1"><button class="btn primary" ${ui.busy ? 'disabled' : ''}>Ask</button></form>
        <p class="muted" style="font-size:12px">Pip can be wrong. Check the sources.</p></section></section>`
  }

  function render() {
    renderChrome()
    if (!me) return
    if (!me.connected) { location.href = '/?error=' + encodeURIComponent('Connect your Buffer account to open Pulse, or try the sample account.'); return }
    const r = route()
    const screens = { start: renderStart, mirror: renderMirror, listen: renderListen, ideas: renderIdeas, evidence: renderEvidence, ask: renderAsk }
    const focusId = document.activeElement?.id
    const caret = document.activeElement?.selectionStart
    view.innerHTML = (screens[r] || renderMirror)()
    if (focusId) {
      const el = document.getElementById(focusId)
      if (el && el.tagName !== 'BUTTON') { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret) } catch {} }
    }
  }

  /* ------------------------------------------------------------ actions */
  const setWs = (w) => { if (w) ws = w }

  async function loadChannels() {
    const ob = ui.ob
    if (SAMPLE) { ob.channels = [{ id: 'c1', name: 'Meera K.', displayName: 'Meera K.', service: 'linkedin' }, { id: 'c2', name: 'meera.money', displayName: 'meera.money', service: 'instagram' }]; ob.channelId = 'c1'; render(); return }
    ob.channels = null
    render()
    try {
      const r = await api('/api/channels?organizationId=' + encodeURIComponent(ob.orgId))
      ob.channels = r.channels
      ob.channelId = r.channels.find((c) => c.id === ws?.onboarding?.channelId)?.id || r.channels.find((c) => c.service === 'linkedin')?.id || null
    } catch (e) { ob.channels = []; toast(e.message) }
    render()
  }

  const actions = {
    'ob-topic': (i) => { ui.ob.topic = i; render() },
    'ob-aud': (i) => { const s = ui.ob.audiences; s.has(i) ? s.delete(i) : s.add(i); render() },
    'ob-own': () => { const v = ui.ob.own.trim(); if (v) { ui.ob.options = [...ui.ob.options, v]; ui.ob.audiences.add(v); ui.ob.own = '' } render() },
    'ob-goal': (i) => { ui.ob.goal = i; render() },
    'ob-freq': (i) => { ui.ob.frequency = i; render() },
    'ob-hunch': (i) => { ui.ob.hunch = i; render() },
    'ob-channel': (i) => { ui.ob.channelId = i; render() },
    'ob-back': () => { ui.ob.step = Math.max(0, ui.ob.step - 1); render() },
    'ob-next': () => run('ob-next', async () => {
      const ob = ui.ob
      if (ob.step === 0) {
        if (!ob.topic.trim()) throw new Error('Tell Pip what you post about first.')
        let list = []
        if (SAMPLE) list = ['Young investors', 'First-time earners', 'Finance students', 'Working professionals', 'Founders', 'Other creators']
        else { try { list = (await api('/api/audiences', { topic: ob.topic })).audiences } catch { list = [] } }
        if (!list.length) list = ['Peers in my industry', 'Potential clients', 'Founders', 'Students', 'Small business owners', 'Professionals in my field']
        ob.options = [...new Set([...list, ...ob.audiences])]
      }
      ob.step += 1
      if (ob.step === 5) setTimeout(loadChannels)
    }),
    'ob-finish': () => run('ob-finish', async () => {
      const ob = ui.ob
      if (!ob.channelId) throw new Error('Pick your LinkedIn channel first.')
      const ch = ob.channels.find((c) => c.id === ob.channelId)
      if (SAMPLE) { location.hash = '#mirror'; return }
      const r = await api('/api/onboarding', { topic: ob.topic, audiences: [...ob.audiences], goal: ob.goal, frequency: ob.frequency, hunch: ob.hunch, organizationId: ob.orgId, channelId: ob.channelId, channelName: `${ch.displayName || ch.name} · LinkedIn` })
      setWs(r.workspace)
      location.hash = '#mirror'
      setTimeout(() => actions.mirror(), 50)
    }),
    mirror: () => run('mirror', async () => {
      if (SAMPLE) return
      try {
        setWs((await api('/api/mirror', { pasted: ui.pastePosts || '' })).workspace)
        ui.needPaste = false
      } catch (e) {
        if (e.code === 'few_posts') { ui.needPaste = true; ui.fewMsg = e.message; return }
        throw e
      }
    }),
    topic: (i) => run('topic', async () => { if (SAMPLE) return sampleOnly(); setWs((await api('/api/topic-check', { choice: i })).workspace) }),
    'test-shift': () => {},
    tab: (i) => { ui.listenTab = i; render() },
    listen: () => run('listen', async () => {
      if (SAMPLE) { ws.clusters = window.PULSE_SAMPLE.workspace.clusters; return }
      if (!ui.paste.trim()) throw new Error('Paste some comments or questions first.')
      const r = await api('/api/listen', { text: ui.paste, sources: [] })
      setWs(r.workspace)
    }),
    research: () => run('research', async () => {
      if (SAMPLE) { ws.lastResearch = new Date().toISOString(); toast('Sample research refreshed.'); return }
      const urls = [...document.querySelectorAll('[data-src]')].map((el) => el.value.trim()).filter(Boolean)
      if (!urls.length) throw new Error('Add at least one newsletter, blog or page link.')
      const r = await api('/api/listen', { text: '', sources: urls })
      setWs(r.workspace)
      ui.sourceDraft = null
      if (r.unreadable?.length) toast(`Pulse couldn't read ${r.unreadable.length} source(s). Try their RSS feed link instead.`)
    }),
    'save-cluster': (i) => run('save-cluster', async () => { if (SAMPLE) return sampleOnly(); await api('/api/ideas', { index: Number(i) }); ws.clusters[i].ideaId = 'saved'; toast('Saved to your Buffer Ideas.') }),
    'brief-cluster': (i) => run('brief-' + i, async () => {
      ui.draft = 0; ui.draftText = null; ui.sent = null; ui.prediction = null
      if (!SAMPLE) setWs((await api('/api/brief', { index: Number(i) })).workspace)
      location.hash = '#ideas'
      setTimeout(() => document.getElementById('brief')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }),
    ideas: () => run('ideas', async () => { if (SAMPLE) { ws.ideas = window.PULSE_SAMPLE.ideas; return } ws.ideas = (await api('/api/ideas/generate', {})).ideas }),
    'save-idea': (i) => run('save-idea', async () => { if (SAMPLE) return sampleOnly(); await api('/api/ideas/save', { idea: ws.ideas[i] }); toast('Saved to your Buffer Ideas.') }),
    'brief-idea': (i) => run('brief-idea-' + i, async () => {
      ui.draft = 0; ui.draftText = null; ui.sent = null; ui.prediction = null
      if (!SAMPLE) setWs((await api('/api/brief', { idea: ws.ideas[i] })).workspace)
      setTimeout(() => document.getElementById('brief')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }),
    'pick-draft': (i) => { ui.draft = Number(i); ui.draftText = null; ui.sent = null; render() },
    predict: (i) => { ui.prediction = i; ui.sent = null; render() },
    mode: (i) => { ui.mode = i; ui.sent = null; render() },
    send: () => run('send', async () => {
      if (!ui.prediction) throw new Error('Make your prediction first: yes or no.')
      const b = ws.brief
      const d = b.drafts[ui.draft]
      const text = ui.draftText ?? d.text
      if (SAMPLE) { ui.sent = { n: 7, prediction: ui.prediction }; return }
      const r = await api('/api/experiments', { text, lever: d.lever, prediction: ui.prediction, mode: ui.mode })
      setWs(r.workspace)
      ui.sent = r.workspace.experiments[0]
    }),
    upload: () => run('upload', async () => {
      if (SAMPLE) return sampleOnly()
      const f = document.getElementById('file')?.files?.[0]
      if (!f) throw new Error('Choose your analytics file first.')
      if (f.size > 3_000_000) throw new Error('That file is over 3 MB. Export a shorter date range.')
      const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(f) })
      setWs((await api('/api/evidence/upload', { data, filename: f.name })).workspace)
    }),
    key: () => run('key', async () => {
      if (SAMPLE) return sampleOnly()
      const el = document.getElementById('pkey')
      const key = el?.value || ''
      if (el) el.value = ''
      setWs((await api('/api/evidence/key', { key })).workspace)
    }),
    'ask-prompt': (i) => {
      const q = { trend: "What's trending in my niche this week?", why: 'Why did my best post do so well?', next: 'What should I test next?', stop: 'Which lever should I stop leaning on?' }[i]
      ask(q, i)
    },
    logout: async () => { await fetch('/auth/logout', { method: 'POST' }); location.href = '/' },
    delete: async () => {
      if (!ui.deleteArmed) { ui.deleteArmed = true; renderChrome(); setTimeout(() => { ui.deleteArmed = false; renderChrome() }, 5000); return }
      try { await api('/api/delete', {}); location.href = '/?error=' + encodeURIComponent('Your Pulse data was deleted and you were signed out.') } catch (e) { toast(e.message) }
    },
  }

  function ask(q, key) {
    if (!q?.trim()) return
    ui.chat = ui.chat.length ? ui.chat : []
    ui.chat.push({ who: 'you', text: q })
    run('ask', async () => {
      if (SAMPLE) {
        const a = window.PULSE_SAMPLE.answers[key] || { answer: 'In your own account, Pip answers this from your coded posts, your results and a live web search, with sources.', sources: [] }
        await new Promise((r) => setTimeout(r, 700))
        ui.chat.push({ who: 'pip', text: a.answer, sources: a.sources })
        return
      }
      try {
        const r = await api('/api/ask', { question: q })
        ui.chat.push({ who: 'pip', text: r.answer, sources: r.sources })
      } catch (e) {
        if (e.message === 'signed out') throw e
        ui.chat.push({ who: 'pip', text: `Sorry, I couldn't answer that just now: ${e.message}` })
      }
    })
  }

  /* ------------------------------------------------------------- events */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]')
    if (!el || el.disabled) return
    const fn = actions[el.dataset.act]
    if (!fn) return
    if (el.tagName === 'BUTTON') e.preventDefault()
    fn(el.dataset.i)
  })
  document.addEventListener('input', (e) => {
    const m = e.target.dataset.model
    if (m === 'topic' || m === 'own') ui.ob[m] = e.target.value
    else if (m === 'paste') ui.paste = e.target.value
    else if (m === 'pastePosts') ui.pastePosts = e.target.value
    else if (m === 'draftText') { ui.draftText = e.target.value; ui.sent = null }
    if (e.target.dataset.src != null) {
      ui.sourceDraft = [...document.querySelectorAll('[data-src]')].map((x) => x.value)
    }
  })
  document.addEventListener('change', async (e) => {
    if (e.target.dataset.model === 'orgId') { ui.ob.orgId = e.target.value; loadChannels() }
    if (e.target.dataset.change === 'lever') {
      const id = e.target.dataset.i
      try { setWs((await api(`/api/posts/${encodeURIComponent(id)}/lever`, { lever: e.target.value })).workspace); toast('Label updated. Thanks, Pip will learn from that.'); render() } catch (err) { toast(err.message) }
    }
  })
  document.addEventListener('submit', (e) => {
    if (e.target.dataset.form === 'ask') { e.preventDefault(); const q = e.target.q.value; ask(q) }
  })
  window.addEventListener('hashchange', () => { ui.error = null; render(); window.scrollTo(0, 0) })

  /* --------------------------------------------------------------- boot */
  async function boot() {
    if (SAMPLE) {
      me = structuredClone(window.PULSE_SAMPLE)
      ws = me.workspace
      ws.ideas = []
      ws.trending = window.PULSE_SAMPLE.workspace.trending
      if (!location.hash) location.hash = '#mirror'
      document.querySelectorAll('#nav a').forEach((a) => { a.href = '?sample=1' + a.getAttribute('href') })
      render()
      return
    }
    try {
      me = await api('/api/me')
      ws = me.workspace || null
      if (me.connected && !ws?.onboarding && route() !== 'start') location.hash = '#start'
      render()
    } catch (e) {
      view.innerHTML = `<div class="err">${esc(e.message)}</div>`
    }
  }
  boot()
})()
