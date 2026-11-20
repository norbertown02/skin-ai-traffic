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
  const [periodMode, setPeriodMode] = useState('month')
  const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth()+1).padStart(2,'0'))
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()))
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)

  async function expireSession(message) {
    request.current?.abort()
    setLoading(false)
    setSession(null); setData(null); setError(message || '')
    await clearSession()
  }

  const localToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const today = localToday()
  const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
  const paramsForPeriod = () => {
    if (periodMode === '30') return { days: 30 }
    if (periodMode === '7') return { days: 7 }
    if (periodMode === '90') return { days: 90 }
    if (periodMode === '180') return { days: 180 }
    let since, until
    if (periodMode === 'month') { since = `${periodYear}-${periodMonth}-01`; until = `${periodYear}-${periodMonth}-${String(new Date(Number(periodYear),Number(periodMonth),0).getDate()).padStart(2,'0')}` }
    else if (periodMode === 'year') { since = `${periodYear}-01-01`; until = `${periodYear}-12-31` }
    else { since = periodStart; until = periodEnd }
    if (!validDay(since) || !validDay(until) || since > until) return null
    if (until > today) until = today
    if (since > until || (Date.parse(until)-Date.parse(since))/86400000 >= 366) return null
    return { since, until, days: String(Math.floor((Date.parse(until)-Date.parse(since))/86400000)+1) }
  }
  const periodParams = paramsForPeriod()
  async function refresh() {
    request.current?.abort()
    if (!periodParams) { setLoading(false); setError('Selecione um período válido.'); return }
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError('')
    try {
      const report = await loadCoreData(periodParams, controller.signal)
      if (!controller.signal.aborted) {
        if (!report?.bootstrap?.performance?.comparison) {
          const bounds=report?.bootstrap?.main?.period
          if(bounds?.start&&bounds?.end){
            const included=m=>{const key=String(m?.month_start||'').slice(0,7);return key && key>=bounds.start.slice(0,7)&&key<=bounds.end.slice(0,7)}
            if(Array.isArray(report?.shopify?.business)) report.shopify.business=report.shopify.business.filter(included)
            if(Array.isArray(report?.funnel?.months)) report.funnel.months=report.funnel.months.filter(included)
          }
        }
        setData(report)
      }
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
  }, [session?.user?.id,periodMode,periodMonth,periodYear,periodStart,periodEnd])
  useEffect(() => {
    const onHash = () => setTab(hashTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const periodControl = <div className="analysis-period-filter" style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',padding:'14px 18px',margin:'12px 0',border:'1px solid rgba(120,100,130,.22)',borderRadius:12,background:'var(--surface,#fff)'}}>
    <label>Período <select aria-label="Selecionar período de todos os relatórios" value={periodMode} onChange={e=>setPeriodMode(e.target.value)}><option value="month">Mês específico</option><option value="year">Ano inteiro</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 180 dias</option><option value="custom">Personalizado</option></select></label>
    {(periodMode==='month'||periodMode==='year')&&<label>Ano <select value={periodYear} onChange={e=>setPeriodYear(e.target.value)}>{Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>}
    {periodMode==='month'&&<label>Mês <select value={periodMonth} onChange={e=>setPeriodMonth(e.target.value)}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((name,i)=><option key={name} value={String(i+1).padStart(2,'0')}>{name}</option>)}</select></label>}
    {periodMode==='custom'&&<><label>De <input type="date" value={periodStart} max={today} onChange={e=>setPeriodStart(e.target.value)}/></label><label>Até <input type="date" value={periodEnd} max={today} onChange={e=>setPeriodEnd(e.target.value)}/></label></>}
    <small style={{marginLeft:'auto'}}>Período aplicado a todas as telas: {data?.bootstrap?.main?.period ? data.bootstrap.main.period.start+' a '+data.bootstrap.main.period.end : 'selecionando…'}</small>
  </div>

  if (session === undefined) return <div className="app-loading"><p>Verificando acesso…</p></div>
  if (!session) return <Login onSuccess={() => setError('')} />

  if (tab === 'executive') {
    return <div className="executive-standalone">{periodControl}
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
    {periodControl}
    {loading && !data ? <div className="app-loading"><div className="loading-mark">S</div><p>Carregando inteligência da operação…</p></div> : error && !data ? <div className="load-error"><h2>Não foi possível carregar o painel</h2><p>{error}</p><button className="btn primary" onClick={refresh}>Tentar novamente</button></div> : page}
    {error && data && <div className="refresh-error">{error}</div>}
    {loading && data && <div className="refresh-indicator">Atualizando dados…</div>}
  </Shell>
}
