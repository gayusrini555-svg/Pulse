# Pulse

**Content research for creators who want to know what works.** Pulse studies your LinkedIn posts like a researcher, reveals your creator archetype, listens to what your audience is asking, and turns it all into fresh ideas and small experiments, then tells you honestly which persuasion levers work for *your* audience.

Built on the Buffer API for **Buffer Commit 2026**. Pulse is an independent project, not an official Buffer product.

## The loop

1. **Mirror**: reads your sent posts (Buffer API, OAuth) and codes each one for hook, emotion and persuasion lever, using a codebook grounded in published research (Cialdini; Berger & Milkman; Loewenstein; Kahneman & Tversky). Your lever mix becomes one of six original archetypes.
2. **Listen**: paste comments, reviews or questions, or add newsletter/blog feeds. Pulse clusters your audience's pain points in their own words and spots trends.
3. **Ideas & drafts**: five fresh post ideas, research briefs with a hypothesis, and three drafts in your voice. Save ideas or drafts to Buffer, or open them in Claude or ChatGPT.
4. **Evidence**: you predict before posting. Results (from your LinkedIn analytics file, or a Buffer personal key used once and never stored) are compared with *your own* median, lever by lever, with honest "early signal" labels under 5 posts. Plus a calibration score for your gut.
5. **Ask Pulse**: questions about your content, results or what's trending, answered from your data and a live web search with sources.

Try it without an account at `/app?sample=1`.

## Buffer API usage

| Feature | Buffer API |
| --- | --- |
| Sign in | OAuth 2.0 + PKCE (`account:read posts:read posts:write ideas:write offline_access`) |
| Pick your LinkedIn channel | `account`, `channels` |
| Mirror | `posts` (sent, paginated) |
| Save drafts / queue experiments | `createPost` |
| Save ideas and pain points | `createIdea` |
| Evidence (optional) | `posts { metrics }` with a personal key, used once, never stored |

## Stack

Node 22 + Express on Vercel (based on Buffer's official app-client starter, MIT), vanilla JS front end, Supabase (Postgres) for each user's workspace, and a pluggable AI layer: Google Gemini, Anthropic Claude or OpenAI GPT.

## Setup

1. `npm install`
2. Create the table: run `supabase.sql` in the Supabase SQL editor.
3. Set environment variables from `.env.example` (on Vercel: Project → Settings → Environment Variables).
4. Register `https://<your-domain>/callback` as the redirect URI on your Buffer app client.
5. `npm test` runs the research-logic and end-to-end flow tests (Buffer and AI are simulated).

## Privacy

Pulse stores only what it needs, never sells data, never posts without a click, and deletes everything on request. See `/privacy`.
