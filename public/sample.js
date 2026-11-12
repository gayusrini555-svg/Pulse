// The sample account: an invented behavioural-finance creator, so anyone can try
// Pulse end to end without connecting Buffer. Shapes match the real /api/me.
window.PULSE_SAMPLE = {
  connected: true,
  sample: true,
  config: { login: true, ai: true, aiName: 'sample answers', db: true },
  account: { name: 'Meera K. (sample)', organizations: [{ id: 'org1', name: 'Meera K.' }] },
  workspace: {
    onboarding: { topic: 'Behavioural finance for young Indian investors', audiences: ['Young investors', 'First-time earners'], goal: 'expert', frequency: '1 to 2 times a week', hunch: 'specificity', channelName: 'Meera K. · LinkedIn' },
    mirror: {
      enough: true, count: 42, analysed: 30, primary: 'librarian', streak: 'spark',
      levers: [
        { key: 'specificity', name: 'Specificity', archetype: 'librarian', n: 11, share: 0.37 },
        { key: 'authority', name: 'Authority', archetype: 'librarian', n: 7, share: 0.23 },
        { key: 'curiosity_gap', name: 'Curiosity gap', archetype: 'spark', n: 5, share: 0.17 },
        { key: 'contrarian', name: 'Contrarian framing', archetype: 'spark', n: 4, share: 0.13 },
        { key: 'narrative', name: 'Narrative', archetype: 'storyteller', n: 3, share: 0.1 },
      ],
      shift: { from: 'librarian', to: 'spark', recentCount: 5, recentOf: 9 },
    },
    topicCheck: { summary: 'Investing behaviour and money habits', onTopic: 27, of: 30, matches: true, resolved: null },
    posts: [
      { id: 'p1', text: 'I checked my last 12 sell orders. 9 came in the week after a market drop. Here is why our brains do this.', lever: 'specificity', hook: 'Number-led', emotion: 'Curiosity', why: 'Opens with an exact count from the creator’s own trades.' },
      { id: 'p2', text: 'Hot take: your SIP is not a strategy. It is a habit. Those are different things.', lever: 'contrarian', hook: 'Bold claim', emotion: 'Surprise', why: '"Hot take" and the rejection of common advice.' },
      { id: 'p3', text: 'Kahneman and Tversky showed losses loom larger than gains. Three ways that shows up in your portfolio.', lever: 'authority', hook: 'Research citation', emotion: 'Calm and informative', why: 'Leans on two named researchers to make the point.' },
    ],
    clusters: [
      { title: 'Why do I keep selling at the wrong time?', count: 11, emotion: 'Frustration', quotes: ['I sold everything in March and regretted it by June.', 'How do I stop panic-selling when the market drops?'], angle: 'Loss aversion: why a loss feels heavier than an equal gain', source: 'Pasted text' },
      { title: 'Is a SIP enough, or am I missing something?', count: 8, emotion: 'Anxiety', quotes: ['Is a SIP enough or am I missing something?', 'Everyone says start a SIP and forget it. Is that it?'], angle: 'The comfort of defaults, and when to look again', source: 'The Money Note (sample)' },
      { title: 'Everyone online seems ahead of me', count: 6, emotion: 'Comparison', quotes: ['Everyone on Instagram seems to be retiring at 40.', 'My friends all own flats already. Am I behind?'], angle: 'Social comparison and the highlight reel', source: 'Investor forum (pasted)' },
    ],
    trending: [
      { title: 'New tax rules on mutual fund gains', note: 'Comes up in 2 of your 3 sources this week' },
      { title: 'Gold vs index funds', note: 'Rising questions in reader replies' },
    ],
    sources: [{ url: 'https://example.com/money-note/feed', ok: true }, { url: 'https://example.com/index-and-chill/rss', ok: true }],
    lastResearch: '2026-11-09T03:30:00Z',
    brief: {
      index: 0, title: 'Loss aversion, told through your audience’s own question', why: '11 mentions of "Why do I keep selling at the wrong time?"',
      leverWhy: 'Specificity is proven for this audience: +34% over 14 posts.', hypothesis: 'A number-led explainer on loss aversion will earn a higher engagement rate than your usual post.', metric: 'engagement rate',
      drafts: [
        { lever: 'specificity', text: '11 people in my comments asked me the same thing this month: why do I keep selling at the wrong time?\n\nThe uncomfortable answer: a ₹10,000 loss feels roughly twice as heavy as a ₹10,000 gain feels good. So we sell to make the pain stop, not because the plan changed.' },
        { lever: 'contrarian', text: 'Your panic-selling is not a discipline problem. It is a design problem.\n\nHere are 3 rules I write down before markets fall, so I never decide in the moment.' },
        { lever: 'reciprocity', text: 'When did you last sell something and regret it within 3 months?\n\nReply with the month. I will share what the pattern says next week.' },
      ],
    },
    experiments: [
      { n: 6, title: 'SIP is a habit, not a strategy', lever: 'contrarian', prediction: 'no', lift: 46, call: 'Underestimated', mode: 'queue' },
      { n: 5, title: 'Loss aversion in one number', lever: 'specificity', prediction: 'yes', lift: 27, call: 'Called it', mode: 'draft' },
      { n: 4, title: 'My first investing mistake', lever: 'narrative', prediction: 'yes', lift: -8, call: 'Missed', mode: 'draft' },
    ],
    evidence: {
      enough: true, measured: 42, baseline: 3.1, metric: 'engagement rate',
      levers: [
        { key: 'contrarian', name: 'Contrarian framing', archetype: 'spark', n: 4, lift: 41, verdict: 'Early signal' },
        { key: 'specificity', name: 'Specificity', archetype: 'librarian', n: 14, lift: 34, verdict: 'Works for you' },
        { key: 'curiosity_gap', name: 'Curiosity gap', archetype: 'spark', n: 6, lift: 18, verdict: 'Works for you' },
        { key: 'authority', name: 'Authority', archetype: 'librarian', n: 9, lift: 2, verdict: 'No clear effect' },
        { key: 'narrative', name: 'Narrative', archetype: 'storyteller', n: 3, lift: -12, verdict: 'Early signal' },
      ],
    },
    evidenceSource: { kind: 'upload', matched: 42 },
    calibration: { right: 6, of: 9 },
    badges: { librarian: 3, spark: 1, storyteller: 0, coach: 0, host: 0, curator: 0 },
  },
  ideas: [
    { title: 'The 3 numbers I check before I sell anything', lever: 'specificity', hook: 'I made a rule after losing ₹40,000 to one bad week.', why: 'Answers the top pain point with your strongest lever.' },
    { title: 'Why "start a SIP and forget it" is only half the advice', lever: 'contrarian', hook: 'The most common money advice in India is missing a step.', why: 'Tests your rising Spark streak on a safe topic.' },
    { title: 'What the new mutual fund tax rules mean in one example', lever: 'utility', hook: 'One ₹1 lakh example, before and after.', why: 'Trending in your sources; practical value is shared widely.' },
    { title: 'I asked 3 friends about their loans', lever: 'narrative', hook: 'Everyone looked ahead of me. Then I asked one question.', why: 'Narrative is barely tested for you; low risk to try.' },
    { title: 'Reply with your worst money decision', lever: 'reciprocity', hook: 'Mine was selling in March 2020.', why: 'Builds conversation; your audience already shares stories in comments.' },
  ],
  answers: {
    trend: { answer: 'Two things stand out this week:\n\n1. New tax rules on mutual fund gains. It comes up in 2 of your 3 sources and readers are confused about what changes.\n2. Gold vs index funds. Questions like "which is safer?" are rising.\n\nNext step: write the tax topic as one worked example with real numbers. That is your strongest lever.', sources: [{ title: 'The Money Note (sample)', url: '#' }, { title: 'Index & Chill (sample)', url: '#' }] },
    why: { answer: 'Experiment 06 beat your usual by 46%. Three things were different: it used contrarian framing (new for you), it went out on Thursday morning (your best slot), and it answered a question 8 people had asked.\n\nOne post is not a pattern. Next step: run two more contrarian posts before calling it.', sources: [] },
    next: { answer: 'Test contrarian framing on a question your audience already asks: "Is a SIP enough?" If it beats your usual again, The Spark earns its second badge.\n\nNext step: open Ideas and send that draft to your Buffer.', sources: [] },
    stop: { answer: 'Authority: 9 posts at +2%. It is not hurting you, but it is not pulling its weight. Try pairing research with a specific number from your own life.\n\nNext step: rewrite your next research post to lead with a personal number.', sources: [] },
  },
}
