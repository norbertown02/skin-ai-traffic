const SUPABASE_URL = 'https://iocczxytwhtovpvaikyq.supabase.co'
const SESSION_KEY = 'skin_tm_session'

export const endpoints = {
  login: `${SUPABASE_URL}/functions/v1/traffic-manager-login`,
  bootstrap: `${SUPABASE_URL}/functions/v1/traffic-manager-secure-api?action=bootstrap&days=30`,
  manager: `${SUPABASE_URL}/functions/v1/traffic-manager-continuous-api`,
  shopify: `${SUPABASE_URL}/functions/v1/traffic-shopify-secure-api`,
  funnel: `${SUPABASE_URL}/functions/v1/traffic-funnel-insights-api`,
  audience: `${SUPABASE_URL}/functions/v1/traffic-audience-insights-api`,
  video: `${SUPABASE_URL}/functions/v1/traffic-video-insights-api`,
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}
export function setSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) }
export function clearSession() { localStorage.removeItem(SESSION_KEY) }

export async function login(username, password) {
  const response = await fetch(endpoints.login, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
  const data = await response.json()
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'login_failed')
  const session = { token: data.token, expires_at: data.expires_at, user: data.user }
  setSession(session)
  return session
}

export async function api(url, init = {}) {
  const session = getSession()
  if (!session?.token) throw new Error('no-session')
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) throw new Error(typeof data === 'string' ? data : data?.error || `HTTP ${response.status}`)
  return data
}

async function optional(url) {
  try { return await api(url) } catch { return null }
}

export async function loadCoreData() {
  const [bootstrap, shopify, funnel, manager, audience, video] = await Promise.all([
    api(endpoints.bootstrap), api(endpoints.shopify), api(endpoints.funnel), api(endpoints.manager), optional(endpoints.audience), optional(endpoints.video),
  ])
  return { bootstrap, shopify, funnel, manager, audience, video }
}
