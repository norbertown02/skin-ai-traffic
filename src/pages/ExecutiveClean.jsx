import React, { useMemo, useState } from 'react'
import { ChartCard } from '../components/Charts.jsx'
import { Funnel } from '../components/UI.jsx'
import { delta, integer, money, monthLabel, num, pct, rate, shortMonth } from '../lib/format.js'

const PURPLE = '#4a215f'
const PURPLE_SOFT = '#8f7899'
const LILAC = '#b29db9'
const GREEN = '#5e7e6e'
const INK = '#2a222a'

const d = (a,b) => delta(a,b)
const trend = (value, inverse=false) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return { label:'—', tone:'neutral' }
  const n = Number(value)
  if (n === 0) return { label:'0%', tone:'neutral' }
  const good = inverse ? n < 0 : n > 0
  return { label:`${n > 0 ? '+' : ''}${num(n,1)}%`, tone:good ? 'good' : 'bad' }
}

function Metric({ label, value, change, inverse=false, helper }) {
  const t = trend(change, inverse)
  return <div className="skin-report-metric">
    <div className="skin-report-metric-label"><span>{label}</span>{change !== undefined && change !== null && <em className={t.tone}>{t.label}</em>}</div>
    <strong>{value}</strong>
    {helper && <small>{helper}</small>}
  </div>
}

function Note({ index, title, text }) {
  return <article className="skin-report-note"><span>{index}</span><div><h3>{title}</h3><p>{text}</p></div></article>
}

function SectionTitle({ kicker, title, text }) {
  return <header className="skin-report-section-title"><span>{kicker}</span><h2>{title}</h2>{text && <p>{text}</p>}</header>
}

export default function ExecutiveClean({data}) {
  const business = data?.shopify?.business || []
  const funnels = data?.funnel?.months || []
  const [selected, setSelected] = useState(business.at(-1)?.month_start || '')
  const current = business.find(x => x.month_start === selected) || business.at(-1)
  if (!current) return <div className="empty-state">Sem dados consolidados para o relatório.</div>

  const index = business.findIndex(x => x.month_start === current.month_start)
  const previous = index > 0 ? business[index - 1] : null
  const funnelMap = useMemo(() => new Map(funnels.map(x => [x.month_start, x])), [funnels])
  const fm = funnelMap.get(current.month_start) || {}
  const pf = previous ? funnelMap.get(previous.month_start) || {} : {}
  const labels = business.map(x => shortMonth(x.month_start))

  const spend = Number(current.meta_spend || 0)
  const revenue = Number(current.shopify_revenue || 0)
  const orders = Number(current.shopify_orders || 0)
  const sessions = Number(current.sessions || 0)
  const aov = orders ? revenue / orders : 0
  const cac = orders ? spend / orders : 0
  const cvr = Number(current.conversion_rate || 0) * 100
  const prevCac = Number(previous?.shopify_orders || 0) ? Number(previous.meta_spend || 0) / Number(previous.shopify_orders || 0) : 0

  const revenueDelta = d(revenue, previous?.shopify_revenue)
  const ordersDelta = d(orders, previous?.shopify_orders)
  const spendDelta = d(spend, previous?.meta_spend)
  const cacDelta = d(cac, prevCac)
  const merDelta = d(current.mer, previous?.mer)
  const cvrDelta = d(current.conversion_rate, previous?.conversion_rate)

  const stages = [
    ['Clique → página', Number(fm.click_to_lpv || 0)],
    ['Página → carrinho', Number(fm.lpv_to_cart || 0)],
    ['Carrinho → checkout', Number(fm.cart_to_checkout || 0)],
    ['Checkout → compra', Number(fm.checkout_to_purchase || 0)],
  ].filter(x => x[1] > 0).sort((a,b) => a[1] - b[1])
  const weakest = stages[0]

  const mediaRead = Number(fm.ctr || 0) >= Number(pf.ctr || 0)
    ? 'A taxa de clique está sustentando ou melhorando a atenção da mídia.'
    : 'A taxa de clique recuou em relação ao mês anterior e merece acompanhamento.'

  return <div className="skin-report">
    <section className="skin-report-cover">
      <div className="skin-report-cover-brand"><span>SKIN BEAUTY</span><small>GESTÃO DE PERFORMANCE</small></div>
      <div className="skin-report-cover-main">
        <div><span className="skin-report-kicker light">RELATÓRIO GERENCIAL</span><h1>Performance<br/>da operação</h1></div>
        <p>Uma leitura mensal de negócio, mídia e funil. Shopify como verdade comercial; Meta como leitura de entrega e atribuição.</p>
      </div>
      <label className="skin-report-month"><span>PERÍODO</span><select value={current.month_start} onChange={e => setSelected(e.target.value)}>{business.slice().reverse().map(x => <option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></label>
    </section>

    <section className="skin-report-page skin-report-overview">
      <div className="skin-report-overview-title"><span>VISÃO DO MÊS</span><h2>{monthLabel(current.month_start)}</h2></div>
      <div className="skin-report-revenue">
        <span>Receita Shopify</span>
        <strong>{money(revenue)}</strong>
        <p>{integer(orders)} pedidos · ticket médio {money(aov)} · conversão {pct(cvr)}</p>
      </div>
      <div className="skin-report-metrics-grid">
        <Metric label="Receita" value={money(revenue)} change={revenueDelta}/>
        <Metric label="Pedidos" value={integer(orders)} change={ordersDelta}/>
        <Metric label="Investimento Meta" value={money(spend)} change={spendDelta} inverse/>
        <Metric label="CAC blended" value={money(cac)} change={cacDelta} inverse/>
        <Metric label="MER" value={num(current.mer)} change={merDelta}/>
        <Metric label="Conversão" value={pct(cvr)} change={cvrDelta}/>
      </div>

      <div className="skin-report-notes">
        <Note index="01" title="Resultado comercial" text={previous ? `A receita ${Number(revenueDelta) >= 0 ? 'cresceu' : 'recuou'} ${num(Math.abs(Number(revenueDelta || 0)),1)}% em relação a ${monthLabel(previous.month_start)}.` : 'Ainda não há mês anterior suficiente para comparação.'}/>
        <Note index="02" title="Ponto de atenção do funil" text={weakest ? `${weakest[0]} apresenta a menor taxa de passagem: ${pct(weakest[1])}.` : 'Os eventos disponíveis ainda não permitem identificar um gargalo confiável.'}/>
        <Note index="03" title="Leitura de mídia" text={`${mediaRead} CPM ${money(fm.cpm)}, CPC ${money(fm.cpc)}, CTR ${pct(fm.ctr)} e frequência ${num(fm.frequency)}.`}/>
      </div>
    </section>

    <section className="skin-report-page">
      <SectionTitle kicker="NEGÓCIO" title="Crescimento e eficiência" text="A evolução mensal mostra se a operação está ganhando escala com qualidade ou apenas comprando mais tráfego."/>
      <div className="skin-report-chart-feature"><ChartCard title="Receita × investimento" subtitle="Evolução mensal" labels={labels} height={360} datasets={[{type:'bar',label:'Receita',data:business.map(x=>Number(x.shopify_revenue||0)),backgroundColor:'rgba(74,33,95,.10)',borderColor:PURPLE,borderWidth:1,borderRadius:2},{type:'line',label:'Investimento',data:business.map(x=>Number(x.meta_spend||0)),borderColor:PURPLE_SOFT,borderWidth:2,tension:.25,pointRadius:2}]}/></div>
      <div className="skin-report-chart-pair">
        <ChartCard title="Pedidos × CAC blended" subtitle="Volume e custo real de aquisição" labels={labels} datasets={[{type:'bar',label:'Pedidos',data:business.map(x=>Number(x.shopify_orders||0)),backgroundColor:'rgba(42,34,42,.08)',borderColor:INK,borderWidth:1,borderRadius:2},{type:'line',label:'CAC',data:business.map(x=>Number(x.shopify_orders||0)?Number(x.meta_spend||0)/Number(x.shopify_orders||0):0),borderColor:PURPLE,borderWidth:2,tension:.25,pointRadius:2}]}/>
        <ChartCard title="MER × ROAS Meta" subtitle="Receita real versus atribuição da plataforma" labels={labels} datasets={[{label:'MER',data:business.map(x=>Number(x.mer||0)),borderColor:PURPLE,borderWidth:2,tension:.25,pointRadius:2},{label:'ROAS Meta',data:business.map(x=>Number(x.meta_roas||0)),borderColor:LILAC,borderWidth:2,tension:.25,pointRadius:2}]}/>
      </div>
    </section>

    <section className="skin-report-band">
      <SectionTitle kicker="FUNIL" title="Do clique à compra" text="Duas verdades lado a lado: atribuição da Meta e comportamento comercial real da Shopify."/>
      <div className="skin-report-funnels">
        <div className="skin-report-funnel"><div className="skin-report-funnel-head"><span>META ADS</span><h3>Funil atribuído</h3></div><Funnel rows={[{label:'Cliques no link',value:fm.link_clicks},{label:'Visualizações da página',value:fm.landing_page_views},{label:'Carrinhos',value:fm.adds_to_cart},{label:'Checkout',value:fm.initiates_checkout},{label:'Compras',value:fm.purchases}]}/></div>
        <div className="skin-report-funnel"><div className="skin-report-funnel-head"><span>SHOPIFY</span><h3>Funil real da loja</h3></div><Funnel color="soft" rows={[{label:'Sessões',value:current.sessions},{label:'Carrinhos',value:current.cart_additions},{label:'Checkout',value:current.reached_checkout},{label:'Compras',value:current.completed_checkout||current.shopify_orders}]}/></div>
      </div>
      <div className="skin-report-rates">
        <div><span>Clique → página</span><strong>{pct(fm.click_to_lpv)}</strong></div>
        <div><span>Página → carrinho</span><strong>{pct(fm.lpv_to_cart)}</strong></div>
        <div><span>Sessão → carrinho</span><strong>{pct(rate(current.cart_additions,current.sessions))}</strong></div>
        <div><span>Sessão → compra</span><strong>{pct(rate(current.completed_checkout||current.shopify_orders,current.sessions))}</strong></div>
      </div>
    </section>

    <section className="skin-report-page">
      <SectionTitle kicker="MÍDIA" title="Eficiência de entrega" text="CPM, CPC, CTR e frequência vistos como comportamento, não como números isolados."/>
      <div className="skin-report-delivery">
        <Metric label="CPM" value={money(fm.cpm)} change={d(fm.cpm,pf.cpm)} inverse/>
        <Metric label="CPC" value={money(fm.cpc)} change={d(fm.cpc,pf.cpc)} inverse/>
        <Metric label="CTR" value={pct(fm.ctr)} change={d(fm.ctr,pf.ctr)}/>
        <Metric label="Frequência" value={num(fm.frequency)} change={d(fm.frequency,pf.frequency)}/>
      </div>
      <div className="skin-report-chart-pair">
        <ChartCard title="CPM" subtitle="Custo por mil impressões" labels={labels} datasets={[{label:'CPM',data:business.map(x=>funnelMap.get(x.month_start)?.cpm||0),borderColor:PURPLE,borderWidth:2,tension:.25,pointRadius:2}]}/>
        <ChartCard title="CPC" subtitle="Custo por clique" labels={labels} datasets={[{label:'CPC',data:business.map(x=>funnelMap.get(x.month_start)?.cpc||0),borderColor:PURPLE_SOFT,borderWidth:2,tension:.25,pointRadius:2}]}/>
        <ChartCard title="CTR" subtitle="Taxa de clique" labels={labels} datasets={[{label:'CTR',data:business.map(x=>funnelMap.get(x.month_start)?.ctr||0),borderColor:GREEN,borderWidth:2,tension:.25,pointRadius:2}]}/>
        <ChartCard title="Frequência" subtitle="Pressão média de repetição" labels={labels} datasets={[{label:'Frequência',data:business.map(x=>funnelMap.get(x.month_start)?.frequency||0),borderColor:INK,borderWidth:2,tension:.25,pointRadius:2}]}/>
      </div>
    </section>
  </div>
}
