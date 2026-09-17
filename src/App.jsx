import React, { useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import Shell from './components/Shell.jsx'
import DiagnosticModal from './components/DiagnosticModal.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import { AnalysisPro, AudiencesPro, CreativesPro, EntityPro, ExecutivePro, IntegrationsPro, ManagerPro, PlacementsPro, WastePro } from './pages/ProPages.jsx'
import { clearSession, getSession, loadCoreData } from './api.js'

export default function App() {
  const [session, setSession] = useState(getSession())
  const [tab, setTab] = useState('manager')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [diagnosticId, setDiagnosticId] = useState(null)

  async function refresh() {
    setLoading(true); setError('')
    try { setData(await loadCoreData()) }
    catch (e) { setError(e.message || 'Falha ao carregar os dados do painel.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (session?.token) refresh() }, [session?.token])

  if (!session?.token) return <Login onSuccess={() => setSession(getSession())} />

  const page = {
    manager: <ManagerPro data={data} onOpen={setDiagnosticId} onRefresh={refresh} />,
    executive: <ExecutivePro data={data} />,
    approvals: <ApprovalsPage data={data} onOpen={setDiagnosticId} onRefresh={refresh} />,
    analysis: <AnalysisPro data={data} />,
    creatives: <CreativesPro data={data} />,
    audiences: <AudiencesPro data={data} />,
    placements: <PlacementsPro data={data} />,
    campaigns: <EntityPro data={data} type="campaign" />,
    sets: <EntityPro data={data} type="ad_set" />,
    ads: <EntityPro data={data} type="ad" />,
    waste: <WastePro data={data} />,
    integrations: <IntegrationsPro data={data} />,
  }[tab]

  return <Shell tab={tab} onTab={setTab} data={data} onLogout={() => { clearSession(); setSession(null); setData(null) }}>
    {loading && !data ? <div className="app-loading"><div className="loading-mark">S</div><p>Carregando inteligência da operação…</p></div> : error && !data ? <div className="load-error"><h2>Não foi possível carregar o painel</h2><p>{error}</p><button className="btn primary" onClick={refresh}>Tentar novamente</button></div> : page}
    {loading && data && <div className="refresh-indicator">Atualizando dados…</div>}
    {diagnosticId && <DiagnosticModal id={diagnosticId} onClose={() => setDiagnosticId(null)} onRefresh={refresh} />}
  </Shell>
}
