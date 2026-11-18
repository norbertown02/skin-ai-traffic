import { createClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const auth = projectUrl && publishableKey ? createClient(projectUrl, publishableKey).auth : null
export const endpoints = {
  report: projectUrl ? projectUrl + '/functions/v1/traffic-report' : '',
}

function requireAuth() {
  if (!auth) throw new Error('A conexão do relatório ainda precisa ser configurada.')
  return auth
}

export function subscribeSession(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => callback(session))
  return () => subscription.unsubscribe()
}

export async function clearSession() {
  await auth?.signOut({ scope: 'local' })
}

export async function login(email, password) {
  const { error } = await requireAuth().signInWithPassword({ email, password })
  if (error) throw error
}

export async function sendAccessLink(email) {
  const { error } = await requireAuth().signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function loadCoreData(params = {}, signal) {
  const { data: { session } } = await requireAuth().getSession()
  if (!session?.access_token) throw new Error('no-session')
  const url = new URL(endpoints.report)
  url.search = new URLSearchParams(params)
  const response = await fetch(url, {
    headers: { apikey: publishableKey, Authorization: 'Bearer ' + session.access_token },
    cache: 'no-store',
    signal,
  })
  const result = await response.json().catch(() => null)
  if (response.status === 401) throw new Error('unauthorized')
  if (!response.ok) throw new Error(result?.error || 'Não foi possível carregar o relatório.')
  return result
}
