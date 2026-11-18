import React, { useEffect, useRef, useState } from 'react'
import Login from './components/Login.jsx'
import Shell from './components/Shell.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import ExecutiveClean from './pages/ExecutiveClean.jsx'
import ActionCenter from './pages/ActionCenter.jsx'
import CreativesClean from './pages/CreativesClean.jsx'
import IntegrationsClean from './pages/IntegrationsClean.jsx'
import StrategyPage from './pages/StrategyPage.jsx'
import ManagerDeep from './pages/ManagerDeep.jsx'
import AnalysisDeep from './pages/AnalysisDeep.jsx'
import AudienceDeep from './pages/AudienceDeep.jsx'
import PlacementDeep from './pages/PlacementDeep.jsx'
import EntityDeep from './pages/EntityDeep.jsx'
import WasteDeep from './pages/WasteDeep.jsx'
import { clearSession, loadCoreData, subscribeSession } from './api.js'

const validTabs = new Set(['actions','strategy','manager','executive','approvals','analysis','creatives','audiences','placements','campaigns','sets','ads','waste','integrations'])
const hashTab = () => {
  const key = String(window.location.hash || '').replace(/^#\/?/, '')
  return validTabs.has(key) ? key : 'actions'
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState(hashTab)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)

  async function expireSession(message) {
    request.current?.abort()
    setLoading(false)
    setSession(null); setData(null); setError(message || '')
    await clearSession()
  }

  async function refresh() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError('')
    try {
      const report = await loadCoreData({}, controller.signal)
      if (!controller.signal.aborted) setData(report)
    } catch (e) {
      if (controller.signal.aborted) return
      const message = e.message || 'Falha ao carregar os dados do painel.'
      if (/^(unauthorized|no-session)$/i.test(message)) expireSession('Sua sessão expirou. Entre novamente.')
      else setError(message)
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }

  function navigate(next) {
    if (!validTabs.has(next)) return
    setTab(next)
    if (window.location.hash !== `#/${next}`) window.history.pushState(null, '', `#/${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => subscribeSession((userSession) => {
    setSession(userSession)
    if (!userSession) {
      request.current?.abort()
      setLoading(false)
      setData(null)
    }
  }), [])
  useEffect(() => {
    if (session?.user?.id) refresh()
    return () => request.current?.abort()
  }, [session?.user?.id])
  useEffect(() => {
    const onHash = () => setTab(hashTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (session === undefined) return <div className="app-loading"><p>Verificando acesso…</p></div>
  if (!session) return <Login onSuccess={() => setError('')} />

  if (tab === 'executive') {
    return <div className="executive-standalone">
      {loading && !data ? <div className="app-loading"><div className="loading-mark">S</div><p>Carregando relatório…</p></div> : error && !data ? <div className="load-error"><h2>Não foi possível carregar o relatório</h2><p>{error}</p><button className="btn primary" onClick={refresh}>Tentar novamente</button></div> : <ExecutiveClean data={data} onBack={() => navigate('manager')} />}
      {error && data && <div className="refresh-error">{error}</div>}
      {loading && data && <div className="refresh-indicator">Atualizando dados…</div>}
    </div>
  }

  const page = {
    actions: <ActionCenter data={data} onNavigate={navigate} onRefresh={refresh} isLoading={loading} />,
    strategy: <StrategyPage data={data} onGoManager={() => navigate('manager')} />,
    manager: <ManagerDeep data={data} onRefresh={refresh} />,
    approvals: <ApprovalsPage />,
    analysis: <AnalysisDeep data={data} />,
    creatives: <CreativesClean data={data} />,
    audiences: <AudienceDeep data={data} onNavigate={navigate} />,
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
  </Shell>
}
