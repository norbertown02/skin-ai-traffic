import React, { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { api, clearSession, endpoints, getSession, loadCoreData, login } from './api.js'

const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(v || 0))
const num = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d })
const integer = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const pct = (v) => `${num(v, 1)}%`
const monthLabel = (s) => s ? new Date(`${s}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'

function ChartBox({ title, labels, data, format = 'number' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = new Chart(ref.current, {
      type: 'line',
      data: { labels, datasets: [{ label: title, data, borderWidth: 2, tension: .35, pointRadius: 3 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: '#eee7ec' }, ticks: { callback: (v) => format === 'money' ? `R$ ${v}` : format === 'pct' ? `${v}%` : v } } },
      },
    })
    return () => chart.destroy()
  }, [title, JSON.stringify(labels), JSON.stringify(data), format])
  return <section className="panel"><div className="panel-head"><h3>{title}</h3></div><div className="chart"><canvas ref={ref} /></div></section>
}

function Login({ onSuccess }) {
  const [username, setUsername] = useState('user')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    try { await login(username, password); onSuccess() } catch { setError('Usuário ou senha inválidos.') } finally { setLoading(false) }
  }
  return <div className="login-layout">
    <section className="login-hero"><div className="brand">SKIN BEAUTY</div><h1>Dados que mostram onde crescer.</h1><p>Meta Ads e Shopify em uma visão executiva clara, visual e profunda.</p></section>
    <form className="login-card" onSubmit={submit}><div className="brand small">AI TRAFFIC MANAGER</div><h2>Bem-vindo de volta</h2><label>Usuário<input value={username} onChange={e => setUsername(e.target.value)} /></label><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>{error && <p className="error">{error}</p>}</form>
  </div>
}

const nav = [
  ['manager', 'Gestor IA'], ['executive', 'Relatório Gerencial'], ['approvals', 'Aprovações'],
  ['analysis', 'Análise Detalhada'], ['creatives', 'Criativos'], ['audiences', 'Públicos'], ['placements', 'Placements'],
  ['campaigns', 'Campanhas'], ['sets', 'Conjuntos'], ['ads', 'Anúncios'], ['waste', 'Desperdícios'], ['integrations', 'Integrações'],
]

function Kpi({ label, value, note }) { return <div className="kpi"><small>{label}</small><b>{value}</b>{note && <span>{note}</span>}</div> }

function Funnel({ rows }) {
  const max = Math.max(1, Number(rows?.[0]?.value || 0))
  return <div className="funnel">{rows.map((r, i) => {
    const prev = i ? Number(rows[i - 1].value || 0) : max
    const step = i ? Number(r.value || 0) / Math.max(1, prev) * 100 : 100
    const total = Number(r.value || 0) / max * 100
    return <div className="funnel-row" key={r.label}><span>{r.label}</span><div className="track"><div className="fill" style={{ width: `${Math.max(2, total)}%` }} /></div><b>{integer(r.value)}</b><em>{pct(step)}</em></div>
  })}</div>
}

function Executive({ data }) {
  const business = data?.shopify?.business || []
  const funnelMonths = data?.funnel?.months || []
  const [selected, setSelected] = useState(business.at(-1)?.month_start || '')
  const current = business.find(x => x.month_start === selected) || business.at(-1)
  const idx = business.findIndex(x => x.month_start === current?.month_start)
  const previous = idx > 0 ? business[idx - 1] : null
  const fm = funnelMonths.find(x => x.month_start === current?.month_start)
  if (!current) return <Empty text="Sem dados gerenciais." />
  const labels = business.map(x => new Date(`${x.month_start}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }))
  return <div className="page">
    <div className="page-title-row"><div><div className="eyebrow">RELATÓRIO GERENCIAL</div><h1>Performance mês a mês</h1><p>Meta Ads + Shopify em uma leitura única.</p></div><select value={current.month_start} onChange={e => setSelected(e.target.value)}>{business.slice().reverse().map(x => <option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></div>
    <div className="kpi-grid"><Kpi label="Investimento" value={money(current.meta_spend)} /><Kpi label="Receita Shopify" value={money(current.shopify_revenue)} /><Kpi label="Pedidos" value={integer(current.shopify_orders)} /><Kpi label="MER" value={num(current.mer)} /><Kpi label="ROAS Meta" value={num(current.meta_roas)} /><Kpi label="Conversão" value={pct(Number(current.conversion_rate || 0) * 100)} /></div>
    <SectionTitle n="01" title="Do clique à compra" text="Funil Meta e funil real da Shopify lado a lado." />
    <div className="grid2"><section className="panel"><h3>Funil Meta</h3><Funnel rows={[['Cliques no link', fm?.link_clicks], ['Visualizações da página', fm?.landing_page_views], ['Carrinhos', fm?.adds_to_cart], ['Checkout', fm?.initiates_checkout], ['Compras', fm?.purchases]].map(([label, value]) => ({ label, value }))} /></section><section className="panel"><h3>Funil Shopify real</h3><Funnel rows={[['Sessões', current.sessions], ['Carrinhos', current.cart_additions], ['Checkout', current.reached_checkout], ['Compras', current.completed_checkout || current.shopify_orders]].map(([label, value]) => ({ label, value }))} /></section></div>
    <SectionTitle n="02" title="Eficiência de entrega" text="Valor atual e comportamento de CPM, CPC, CTR e frequência." />
    <div className="kpi-grid four"><Kpi label="CPM" value={money(fm?.cpm)} /><Kpi label="CPC" value={money(fm?.cpc)} /><Kpi label="CTR" value={pct(fm?.ctr)} /><Kpi label="Frequência" value={num(fm?.frequency)} /></div>
    <div className="grid2"><ChartBox title="CPM" labels={labels} data={business.map(x => funnelMonths.find(f => f.month_start === x.month_start)?.cpm || 0)} format="money" /><ChartBox title="CPC" labels={labels} data={business.map(x => funnelMonths.find(f => f.month_start === x.month_start)?.cpc || 0)} format="money" /><ChartBox title="CTR" labels={labels} data={business.map(x => funnelMonths.find(f => f.month_start === x.month_start)?.ctr || 0)} format="pct" /><ChartBox title="Frequência" labels={labels} data={business.map(x => funnelMonths.find(f => f.month_start === x.month_start)?.frequency || 0)} /></div>
    <SectionTitle n="03" title="Evolução" text="Investimento, receita e eficiência ao longo dos meses." />
    <div className="grid2"><ChartBox title="Receita Shopify" labels={labels} data={business.map(x => Number(x.shopify_revenue || 0))} format="money" /><ChartBox title="Investimento Meta" labels={labels} data={business.map(x => Number(x.meta_spend || 0))} format="money" /></div>
    {previous && <div className="note">Comparativo selecionado: {monthLabel(previous.month_start)} → {monthLabel(current.month_start)}</div>}
  </div>
}

function Manager({ data, refresh }) {
  const ctx = data?.manager?.context || {}
  const summary = ctx.last_reasoning_summary || {}
  const business = data?.shopify?.business || []
  const currentMonth = business.at(-1)
  const decision = (data?.manager?.decisions || []).find(x => x.status === 'open') || (data?.manager?.decisions || [])[0]
  const action = decision?.recommended_action || {}
  return <div className="page"><div className="page-title-row"><div><div className="eyebrow">CONSULTOR IA</div><h1>O que está acontecendo e o que fazer agora</h1><p>{summary.reason || 'Análise contínua Meta + Shopify.'}</p></div><button className="secondary" onClick={refresh}>Atualizar consultor</button></div>
    <div className="kpi-grid four"><Kpi label="ROAS Meta 3d" value={num(summary.current_3d?.roas)} /><Kpi label={`Pedidos Shopify · ${monthLabel(currentMonth?.month_start)}`} value={integer(currentMonth?.shopify_orders)} /><Kpi label="Receita Shopify" value={money(currentMonth?.shopify_revenue)} /><Kpi label="MER" value={num(currentMonth?.mer)} /></div>
    <div className="grid2"><section className="panel"><div className="eyebrow">DIAGNÓSTICO PRINCIPAL</div><h2>{decision?.title || 'Sem decisão crítica aberta'}</h2><p>{action.diagnosis || action.executive_summary || decision?.rationale || 'Monitorando a operação.'}</p></section><section className="panel"><div className="eyebrow">PLANO DE AÇÃO</div><h2>{action.exact_action || 'Continuar monitorando até haver evidência suficiente.'}</h2><p>{action.expected_impact || ''}</p></section></div>
  </div>
}

function Approvals({ data, onOpen }) {
  const decisions = (data?.manager?.decisions || []).filter(x => x.model === 'traffic-manager-v3')
  return <div className="page"><div className="eyebrow">CENTRAL DE APROVAÇÕES</div><h1>Decisões do Gestor IA</h1><div className="cards">{decisions.length ? decisions.map(d => <article className="card" key={d.id}><div><span className="pill">{d.status || 'open'}</span><h3>{d.title}</h3><p>{d.recommended_action?.executive_summary || d.rationale}</p></div><div className="card-actions"><button onClick={() => onOpen(d.id)}>Ver diagnóstico</button></div></article>) : <Empty text="Nenhuma decisão disponível." />}</div></div>
}

function DiagnosticModal({ id, onClose }) {
  const [data, setData] = useState(null)
  useEffect(() => { api(`${endpoints.manager}?decision_id=${encodeURIComponent(id)}`).then(setData).catch(() => setData({ error: true })) }, [id])
  return <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal"><button className="modal-close" onClick={onClose}>Fechar</button>{!data ? <Empty text="Carregando diagnóstico…" /> : data.error ? <Empty text="Não foi possível carregar o diagnóstico." /> : <><div className="eyebrow">DIAGNÓSTICO DO CONSULTOR IA</div><h1>{data.explain?.title || data.decision?.title}</h1><p>{data.explain?.diagnosis || data.decision?.rationale}</p><SectionTitle n="01" title="Evidências" text="Sinais usados para sustentar a recomendação." /><div className="panel">{(data.explain?.evidence || data.decision?.recommended_action?.evidence_summary || []).map((x, i) => <p key={i}>• {x}</p>)}</div><SectionTitle n="02" title="Ação recomendada" text="Próximo passo sugerido pelo Gestor." /><div className="panel"><h3>{data.explain?.action || data.decision?.recommended_action?.exact_action}</h3></div></>}</div></div>
}

function GenericPage({ title }) { return <div className="page"><div className="eyebrow">SKIN BEAUTY</div><h1>{title}</h1><p>Esta rota já está sob o novo frontend GitHub e será portada para o novo componente sem reintroduzir o frontend antigo.</p></div> }
function Empty({ text }) { return <div className="empty">{text}</div> }
function SectionTitle({ n, title, text }) { return <div className="section-title"><div><span>{n}</span><h2>{title}</h2></div><p>{text}</p></div> }

export default function App() {
  const [session, setSessionState] = useState(getSession())
  const [tab, setTab] = useState('manager')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [diag, setDiag] = useState(null)
  async function refresh() { setLoading(true); try { setData(await loadCoreData()) } catch (e) { console.error(e) } finally { setLoading(false) } }
  useEffect(() => { if (session?.token) refresh() }, [session?.token])
  if (!session?.token) return <Login onSuccess={() => setSessionState(getSession())} />
  const labels = Object.fromEntries(nav)
  return <div className="app-shell"><aside className="sidebar"><div className="brand">SKIN BEAUTY</div><div className="subbrand">AI TRAFFIC MANAGER</div><nav>{nav.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav><button className="logout" onClick={() => { clearSession(); setSessionState(null) }}>Sair</button></aside><main className="content">{loading && !data ? <Empty text="Carregando dados…" /> : tab === 'manager' ? <Manager data={data} refresh={refresh} /> : tab === 'executive' ? <Executive data={data} /> : tab === 'approvals' ? <Approvals data={data} onOpen={setDiag} /> : <GenericPage title={labels[tab]} />}</main>{diag && <DiagnosticModal id={diag} onClose={() => setDiag(null)} />}</div>
}
