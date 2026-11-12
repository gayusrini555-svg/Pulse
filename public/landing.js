(function () {
  const A = window.PulseArt
  const order = ['librarian', 'spark', 'storyteller', 'coach', 'host', 'curator']
  const levers = {
    librarian: ['Specificity', 'Authority'], spark: ['Contrarian framing', 'Curiosity gap'], storyteller: ['Narrative', 'Vulnerability'],
    coach: ['Utility', 'Loss framing'], host: ['Reciprocity', 'Belonging'], curator: ['Social proof', 'Novelty'],
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  const reel = document.getElementById('reel')
  if (reel) {
    const one = order.map((k) => {
      const f = A.FACES[k]
      return `<div class="reel-card">${A.face(k, 64, 'bob2')}<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><b style="font-family:var(--display);font-weight:600;font-size:19px">${esc(f.name)}</b><span class="muted" style="font-size:13px">${esc(f.line)}</span><span class="mono" style="font-size:12px;font-weight:700;color:${f.color}">${esc(levers[k].join(' · '))}</span></div></div>`
    }).join('')
    reel.innerHTML = one + one
  }

  const grid = document.getElementById('arch-grid')
  if (grid) {
    grid.innerHTML = order.map((k, i) => {
      const f = A.FACES[k]
      return `<article class="card rise d${(i % 5) + 1}" style="flex-direction:row;align-items:center;gap:18px">${A.face(k, 96, i % 2 ? 'bob2' : 'bob')}<div class="stack" style="gap:4px"><h3>${esc(f.name)}</h3><p class="muted">${esc(f.line)}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${levers[k].map((l) => `<span class="tag lever" style="background:${f.color}">${esc(l)}</span>`).join('')}</div></div></article>`
    }).join('')
  }

  const lg = document.getElementById('lever-grid')
  if (lg) {
    const src = [
      ['Specificity', 'Concrete detail makes ideas credible (Heath & Heath)'], ['Authority', 'Cialdini, Influence'], ['Contrarian framing', 'Surprise drives sharing (Berger & Milkman)'],
      ['Curiosity gap', 'Information-gap theory (Loewenstein)'], ['Narrative', 'Narrative transportation (Green & Brock)'], ['Loss framing', 'Prospect theory (Kahneman & Tversky)'],
    ]
    lg.innerHTML = src.map(([n, s]) => `<div class="lever-pill"><b>${esc(n)}</b><span class="muted" style="font-size:13px">${esc(s)}</span></div>`).join('')
  }

  const err = new URLSearchParams(location.search).get('error')
  if (err) {
    const box = document.getElementById('error')
    box.hidden = false
    box.querySelector('.err').textContent = err
  }
})()
