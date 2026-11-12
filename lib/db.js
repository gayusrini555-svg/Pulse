// Each Pulse user has one row: their Buffer account id plus a JSON workspace.
// We talk to Supabase's REST API directly (no SDK) with the service-role key,
// which never leaves the server. Row Level Security is on with no policies, so
// the public anon key can read nothing.
import { SUPABASE_SERVICE_KEY, SUPABASE_URL } from './config.js'

const TABLE = 'pulse_users'
const memory = new Map() // fallback for local development without Supabase

export const dbConfigured = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY)

function headers(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function check(res, what) {
  if (res.ok) return
  const body = await res.text().catch(() => '')
  console.error(JSON.stringify({ event: 'supabase_error', what, status: res.status, body: body.slice(0, 300) }))
  throw new Error(`Could not ${what}. Please try again.`)
}

export async function getWorkspace(id) {
  if (!dbConfigured()) return structuredClone(memory.get(id) || {})
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=data`, { headers: headers() })
  await check(res, 'load your workspace')
  const rows = await res.json()
  return rows[0]?.data || {}
}

export async function saveWorkspace(id, data) {
  if (!dbConfigured()) { memory.set(id, structuredClone(data)); return }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
  })
  await check(res, 'save your workspace')
}

// Load, change, save. Returns the updated workspace.
export async function updateWorkspace(id, change) {
  const ws = await getWorkspace(id)
  const next = (await change(ws)) || ws
  await saveWorkspace(id, next)
  return next
}

export async function deleteWorkspace(id) {
  if (!dbConfigured()) { memory.delete(id); return }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
  await check(res, 'delete your data')
}

// A tiny read that keeps a free Supabase project from pausing during judging.
export async function ping() {
  if (!dbConfigured()) return 'no-database'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id&limit=1`, { headers: headers() })
  return res.ok ? 'ok' : `error ${res.status}`
}
