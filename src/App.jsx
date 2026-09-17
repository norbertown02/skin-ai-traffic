import React, { useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import Shell from './components/Shell.jsx'
import DiagnosticModal from './components/DiagnosticModal.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import ExecutiveClean from './pages/ExecutiveClean.jsx'
import CreativesClean from './pages/CreativesClean.jsx'
import IntegrationsClean from './pages/IntegrationsClean.jsx'
import ManagerDeep from './pages/ManagerDeep.jsx'
import AnalysisDeep from './pages/AnalysisDeep.jsx'
import AudienceDeep from './pages/AudienceDeep.jsx'
import PlacementDeep from './pages/PlacementDeep.jsx'
import EntityDeep from './pages/EntityDeep.jsx'
import WasteDeep from './pages/WasteDeep.jsx'
import { api, clearSession, endpoints, getSession, loadCoreData } from './api.js'

const validTabs = new Set(['manager','executive','approvals','analysis','creatives','audiences','placements','campaigns','sets','ads','waste','integrations'])
const hashTab = () => {
  const key = String(window.location.hash || '').replace(/^#\/?/, '')
  return validTabs.has(key) ? key : 'manager'
}

export default function App() {
  const [session, setSession] = useState(getSession())
  const [tab, setTab] = useState(hashTab)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [diagnosticId, setDiagnosticId] = useState(null)

  function expireSession(message) {
    clearSession(); setSession(null); setData(null); setError(message || '')
  }

  async function refresh() {
    setLoading(true); setError('')
    try { setData(await loadCoreData()) }
    catch (e) {
      const message = e.message || 'Falha ao carregar os dados do painel.'
      if (/unauthorized|no-session|forbidden/i.test(message)) expireSession('Sua sessão expirou. Entre novamente.')
      else setError(message)
    } finally { setLoading(false) }
  }

  async function runManager() {
    setLoading(true); setError('')
    try {
      await api(endpoints.manager, { method: 'POST', body: JSON.stringify({ action: 'run' }) })
      setData(await loadCoreData())
    } catch (e) {
      const message = e.message || 'Não foi possível atualizar a leitura do Gestor IA.'
      if (/unauthorized|no-session|forbidden/i.test(message)) expireSession('Sua sessão expirou. Entre novamente.')
      else setError(message)
    } finally { setLoading(false) }
  }

  function navigate(next) {
    if (!validTabs.has(next)) return
    setTab(next)
    if (window.location.hash !== `#/${next}`) window.history.pushState(null, '', `#/${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => { if (session?.token) refresh() }, [session?.token])
  useEffect(() => {
    const onHash = () => setTab(hashTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!session?.token) return <Login onSuccess={() => { setSession(getSession()); setError('') }} />

  if (tab === 'executive') {
    return <div className="executive-standalone">
      {loading && !data ? <div className="app-loading"><div className="loading-mark">S</div><p>Carregando relatório…</p></div> : error && !data ? <div className="load-error"><h2>Não foi possível carregar o relatório</h2><p>{error}</p><button className="btn primary" onClick={refresh}>Tentar novamente</button></div> : <ExecutiveClean data={data} onBack={() => navigate('manager')} />}
      {error && data && <div className="refresh-error">{error}</div>}
      {loading && data && <div className="refresh-indicator">Atualizando dados…</div>}
    </div>
  }

  const page = {
    manager: <ManagerDeep data={data} onOpen={setDiagnosticId} onRefresh={runManager} />,
    approvals: <ApprovalsPage data={data} onOpen={setDiagnosticId} onRefresh={refresh} />,
    analysis: <AnalysisDeep data={data} />,
    creatives: <CreativesClean data={data} />,
    audiences: <AudienceDeep data={data} />,
    placements: <PlacementDeep data={data} />,
    campaigns: <EntityDeep data={data} type="campaign" />,
    sets: <EntityDeep data={data} type="ad_set" />,
    ads: <EntityDeep data={data} type="ad" />,
    waste: <WasteDeep data={data} />,
    integrations: <IntegrationsClean data={data} />,
  }[tab]

  return <Shell tab={tab} onTab={navigate} data={data} onLogout={() => expireSession('')}>
    {loading && !data ? <div className="app-loading"><div className="loading-mark">S</div><p>Carregando inteligência da operação…</p></div> : error && !data ? <div className="load-error"><h2>Não foi possível carregar o painel</h2><p>{error}</p><button className="btn primary" onClick={refresh}>Tentar novamente</button></div> : page}
    {error && data && <div className="refresh-error">{error}</div>}
    {loading && data && <div className="refresh-indicator">Atualizando dados…</div>}
    {diagnosticId && <DiagnosticModal id={diagnosticId} onClose={() => setDiagnosticId(null)} onRefresh={refresh} />}
  </Shell>
}
