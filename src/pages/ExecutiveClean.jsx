import React, { useMemo, useState } from 'react'
import { ChartCard } from '../components/Charts.jsx'
import { Funnel, MiniMetric } from '../components/UI.jsx'
import { delta, integer, money, monthLabel, num, pct, rate, shortMonth } from '../lib/format.js'

const plum = '#6d2f69'
const rose = '#a85d7c'
const blush = '#c49aaf'
const ink = '#2d1b2b'
const green = '#32735c'

const d = (a,b) => delta(a,b)
const trend = (v, inverse=false) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return { text:'—', cls:'flat' }
  const n = Number(v)
  const good = inverse ? n < 0 : n > 0
  return { text:`${n>0?'+':''}${num(n,1)}%`, cls:n===0?'flat':good?'good':'bad' }
}

function KPI({label,value,change,inverse=false,sub}){
  const t=trend(change,inverse)
  return <div className="exec-kpi"><div className="exec-kpi-top"><span>{label}</span><em className={t.cls}>{t.text}</em></div><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>
}

function Read({label,title,text,tone='neutral'}){
  return <div className={`exec-read ${tone}`}><span>{label}</span><strong>{title}</strong><p>{text}</p></div>
}

export default function ExecutiveClean({data}){
  const business=data?.shopify?.business||[]
  const funnels=data?.funnel?.months||[]
  const [selected,setSelected]=useState(business.at(-1)?.month_start||'')
  const current=business.find(x=>x.month_start===selected)||business.at(-1)
  if(!current)return <div className="empty-state">Sem dados consolidados para o relatório.</div>
  const idx=business.findIndex(x=>x.month_start===current.month_start)
  const prev=idx>0?business[idx-1]:null
  const fmap=useMemo(()=>new Map(funnels.map(x=>[x.month_start,x])),[funnels])
  const fm=fmap.get(current.month_start)||{}
  const pf=prev?fmap.get(prev.month_start)||{}:{}
  const labels=business.map(x=>shortMonth(x.month_start))
  const spend=Number(current.meta_spend||0), revenue=Number(current.shopify_revenue||0), orders=Number(current.shopify_orders||0), sessions=Number(current.sessions||0)
  const cac=orders?spend/orders:0
  const aov=orders?revenue/orders:0
  const cvr=Number(current.conversion_rate||0)*100
  const prevCac=Number(prev?.shopify_orders||0)?Number(prev.meta_spend||0)/Number(prev.shopify_orders||0):0
  const leaks=[['Clique → página',Number(fm.click_to_lpv||0)],['Página → carrinho',Number(fm.lpv_to_cart||0)],['Carrinho → checkout',Number(fm.cart_to_checkout||0)],['Checkout → compra',Number(fm.checkout_to_purchase||0)]].filter(x=>x[1]>0).sort((a,b)=>a[1]-b[1])
  const leak=leaks[0]
  const revenueDelta=d(revenue,prev?.shopify_revenue)
  const cpmDelta=d(fm.cpm,pf.cpm)
  const ctrDelta=d(fm.ctr,pf.ctr)
  const commerceTitle=revenueDelta===null?'Sem base comparável':revenueDelta>=0?'Receita avançou':'Receita recuou'
  const mediaTitle=(cpmDelta||0)>10&&(ctrDelta||0)<-10?'Leilão mais caro e atenção pior':(ctrDelta||0)>8?'Atenção melhorou':'Entrega sem ruptura forte'

  return <div className="page executive-clean-page">
    <header className="exec-header">
      <div><span className="exec-eyebrow">RELATÓRIO GERENCIAL</span><h1>Performance da operação</h1><p>Resultado comercial real da Shopify e eficiência de mídia da Meta, com leitura mensal objetiva.</p></div>
      <label className="exec-month"><span>Mês</span><select value={current.month_start} onChange={e=>setSelected(e.target.value)}>{business.slice().reverse().map(x=><option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></label>
    </header>

    <section className="exec-summary">
      <div className="exec-summary-main"><span>Receita Shopify</span><strong>{money(revenue)}</strong><p>{integer(orders)} pedidos · ticket {money(aov)} · conversão {pct(cvr)}</p></div>
      <div className="exec-summary-metrics"><div><span>Investimento</span><strong>{money(spend)}</strong></div><div><span>MER</span><strong>{num(current.mer)}</strong></div><div><span>CAC blended</span><strong>{money(cac)}</strong></div></div>
    </section>

    <div className="exec-kpi-grid">
      <KPI label="Receita" value={money(revenue)} change={revenueDelta} />
      <KPI label="Pedidos" value={integer(orders)} change={d(orders,prev?.shopify_orders)} />
      <KPI label="Investimento Meta" value={money(spend)} change={d(spend,prev?.meta_spend)} inverse />
      <KPI label="CAC blended" value={money(cac)} change={d(cac,prevCac)} inverse />
      <KPI label="MER" value={num(current.mer)} change={d(current.mer,prev?.mer)} />
      <KPI label="Conversão site" value={pct(cvr)} change={d(current.conversion_rate,prev?.conversion_rate)} />
    </div>

    <div className="exec-reading-grid">
      <Read label="NEGÓCIO" title={commerceTitle} text={prev?`Receita ${revenueDelta>=0?'subiu':'caiu'} ${num(Math.abs(revenueDelta||0),1)}% contra ${monthLabel(prev.month_start)}.`:'Ainda não há mês anterior comparável.'} tone={revenueDelta>=0?'positive':'warning'} />
      <Read label="FUNIL" title={leak?.[0]||'Sem gargalo definido'} text={leak?`Taxa de passagem de ${pct(leak[1])}. É a etapa com maior perda relativa no funil Meta.`:'Os eventos disponíveis ainda não permitem apontar um gargalo.'} tone="warning" />
      <Read label="MÍDIA" title={mediaTitle} text={`CPM ${money(fm.cpm)} · CPC ${money(fm.cpc)} · CTR ${pct(fm.ctr)} · frequência ${num(fm.frequency)}.`} />
    </div>

    <section className="exec-section"><div className="exec-section-head"><span>01</span><div><small>NEGÓCIO</small><h2>Escala e eficiência</h2><p>Quatro gráficos para entender crescimento, volume, custo de aquisição e qualidade do tráfego.</p></div></div>
      <div className="exec-chart-grid"><ChartCard title="Receita × investimento" subtitle="Evolução mensal" labels={labels} datasets={[{type:'bar',label:'Receita',data:business.map(x=>Number(x.shopify_revenue||0)),backgroundColor:'rgba(109,47,105,.16)',borderColor:plum,borderWidth:1,borderRadius:8},{type:'line',label:'Investimento',data:business.map(x=>Number(x.meta_spend||0)),borderColor:rose,borderWidth:3,tension:.35,pointRadius:2}]}/><ChartCard title="Pedidos × CAC blended" subtitle="Volume versus custo real por pedido" labels={labels} datasets={[{type:'bar',label:'Pedidos',data:business.map(x=>Number(x.shopify_orders||0)),backgroundColor:'rgba(45,27,43,.11)',borderColor:ink,borderWidth:1,borderRadius:8},{type:'line',label:'CAC',data:business.map(x=>Number(x.shopify_orders||0)?Number(x.meta_spend||0)/Number(x.shopify_orders||0):0),borderColor:rose,borderWidth:3,tension:.35,pointRadius:2}]}/><ChartCard title="MER × ROAS Meta" subtitle="Receita real versus atribuição da plataforma" labels={labels} datasets={[{label:'MER',data:business.map(x=>Number(x.mer||0)),borderColor:plum,backgroundColor:'rgba(109,47,105,.07)',fill:true,borderWidth:3,tension:.35,pointRadius:2},{label:'ROAS Meta',data:business.map(x=>Number(x.meta_roas||0)),borderColor:blush,borderWidth:2,tension:.35,pointRadius:2}]}/><ChartCard title="Sessões × conversão" subtitle="Qualidade do tráfego na loja" labels={labels} datasets={[{type:'bar',label:'Sessões',data:business.map(x=>Number(x.sessions||0)),backgroundColor:'rgba(196,154,175,.18)',borderColor:blush,borderWidth:1,borderRadius:8},{type:'line',label:'Conversão %',data:business.map(x=>Number(x.conversion_rate||0)*100),borderColor:green,borderWidth:3,tension:.35,pointRadius:2}]}/></div>
    </section>

    <section className="exec-section"><div className="exec-section-head"><span>02</span><div><small>FUNIL</small><h2>Do clique à compra</h2><p>Meta para leitura de mídia; Shopify para comportamento comercial real.</p></div></div>
      <div className="exec-funnel-grid"><div className="exec-panel"><div className="exec-panel-head"><small>META ADS</small><h3>Funil atribuído</h3></div><Funnel rows={[{label:'Cliques no link',value:fm.link_clicks},{label:'Visualizações da página',value:fm.landing_page_views},{label:'Carrinhos',value:fm.adds_to_cart},{label:'Checkout',value:fm.initiates_checkout},{label:'Compras',value:fm.purchases}]}/><div className="exec-mini-grid"><MiniMetric label="Clique → página" value={pct(fm.click_to_lpv)}/><MiniMetric label="Página → carrinho" value={pct(fm.lpv_to_cart)}/><MiniMetric label="Carrinho → checkout" value={pct(fm.cart_to_checkout)}/><MiniMetric label="Checkout → compra" value={pct(fm.checkout_to_purchase)}/></div></div><div className="exec-panel"><div className="exec-panel-head"><small>SHOPIFY</small><h3>Funil real da loja</h3></div><Funnel color="soft" rows={[{label:'Sessões',value:current.sessions},{label:'Carrinhos',value:current.cart_additions},{label:'Checkout',value:current.reached_checkout},{label:'Compras',value:current.completed_checkout||current.shopify_orders}]}/><div className="exec-mini-grid"><MiniMetric label="Sessão → carrinho" value={pct(rate(current.cart_additions,current.sessions))}/><MiniMetric label="Carrinho → checkout" value={pct(rate(current.reached_checkout,current.cart_additions))}/><MiniMetric label="Checkout → compra" value={pct(rate(current.completed_checkout||current.shopify_orders,current.reached_checkout))}/><MiniMetric label="Sessão → compra" value={pct(rate(current.completed_checkout||current.shopify_orders,current.sessions))}/></div></div></div>
    </section>

    <section className="exec-section"><div className="exec-section-head"><span>03</span><div><small>ENTREGA</small><h2>CPM, CPC, CTR e frequência</h2><p>Indicadores de leilão, atenção e pressão de mídia, cada um com sua tendência histórica.</p></div></div>
      <div className="exec-delivery-kpis"><KPI label="CPM" value={money(fm.cpm)} change={cpmDelta} inverse/><KPI label="CPC" value={money(fm.cpc)} change={d(fm.cpc,pf.cpc)} inverse/><KPI label="CTR" value={pct(fm.ctr)} change={ctrDelta}/><KPI label="Frequência" value={num(fm.frequency)} change={d(fm.frequency,pf.frequency)} /></div>
      <div className="exec-chart-grid"><ChartCard title="CPM" subtitle="Custo por mil impressões" labels={labels} datasets={[{label:'CPM',data:business.map(x=>fmap.get(x.month_start)?.cpm||0),borderColor:plum,borderWidth:3,tension:.35,pointRadius:2}]}/><ChartCard title="CPC" subtitle="Custo por clique" labels={labels} datasets={[{label:'CPC',data:business.map(x=>fmap.get(x.month_start)?.cpc||0),borderColor:rose,borderWidth:3,tension:.35,pointRadius:2}]}/><ChartCard title="CTR" subtitle="Taxa de clique" labels={labels} datasets={[{label:'CTR',data:business.map(x=>fmap.get(x.month_start)?.ctr||0),borderColor:green,borderWidth:3,tension:.35,pointRadius:2}]}/><ChartCard title="Frequência" subtitle="Pressão média de repetição" labels={labels} datasets={[{label:'Frequência',data:business.map(x=>fmap.get(x.month_start)?.frequency||0),borderColor:ink,borderWidth:3,tension:.35,pointRadius:2}]}/></div>
    </section>
  </div>
}
