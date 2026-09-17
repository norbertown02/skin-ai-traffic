import React, { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { delta, integer, money, monthLabel, num, pct, rate, shortMonth } from '../lib/format.js'

const safe = v => Number(v || 0)
const d = (a,b) => delta(a,b)
const purple = '#4b285c'
const lilac = '#b9a6c0'
const mauve = '#8b6f92'
const green = '#5f816f'
const rose = '#b76d86'

function Change({value,inverse=false}){
  if(value===null||value===undefined||Number.isNaN(Number(value))) return <span className="sx-change neutral">—</span>
  const n=Number(value), good=inverse?n<0:n>0
  return <span className={`sx-change ${n===0?'neutral':good?'good':'bad'}`}>{n>0?'+':''}{num(n,1)}%</span>
}

function KPI({label,value,change,inverse=false,sub,tone='plain'}){
  return <article className={`sx-kpi ${tone}`}><div className="sx-kpi-top"><span>{label}</span><Change value={change} inverse={inverse}/></div><strong>{value}</strong>{sub&&<small>{sub}</small>}</article>
}

function InteractiveChart({labels,datasets,height=320,yFormat='number'}){
  const ref=useRef(null)
  useEffect(()=>{
    if(!ref.current) return
    const ctx=ref.current.getContext('2d')
    const chart=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:{duration:500},plugins:{legend:{display:true,position:'top',align:'end',labels:{boxWidth:8,boxHeight:8,usePointStyle:true,pointStyle:'circle',padding:18,color:'#6f6671',font:{size:11,weight:'500'}}},tooltip:{backgroundColor:'#3c2546',padding:12,cornerRadius:12,titleFont:{size:12,weight:'600'},bodyFont:{size:12},displayColors:true,callbacks:{label:(c)=>{const v=Number(c.raw||0);if(yFormat==='money')return `${c.dataset.label}: ${money(v)}`;if(yFormat==='percent')return `${c.dataset.label}: ${pct(v)}`;return `${c.dataset.label}: ${num(v,1)}`}}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#8a808a',font:{size:10}}},y:{grid:{color:'rgba(75,40,92,.08)'},border:{display:false},ticks:{color:'#8a808a',font:{size:10},callback:(v)=>yFormat==='money'?`R$ ${Number(v).toLocaleString('pt-BR',{notation:'compact'})}`:yFormat==='percent'?`${v}%`:Number(v).toLocaleString('pt-BR',{notation:'compact'})}}}}})
    return ()=>chart.destroy()
  },[labels,datasets,yFormat])
  return <div className="sx-chart-canvas" style={{height}}><canvas ref={ref}/></div>
}

function FunnelStep({label,value,base,rateValue,index}){
  const width=base?Math.max(10,Math.min(100,(safe(value)/base)*100)):0
  return <div className="sx-funnel-step"><div className="sx-funnel-index">0{index+1}</div><div className="sx-funnel-copy"><span>{label}</span><strong>{integer(value)}</strong></div><div className="sx-funnel-bar"><i style={{width:`${width}%`}}/></div><em>{index===0?'base':pct(rateValue)}</em></div>
}

function Funnel({title,subtitle,rows}){
  const base=Math.max(safe(rows?.[0]?.value),1)
  return <article className="sx-funnel"><div className="sx-funnel-title"><span>{subtitle}</span><h3>{title}</h3></div>{rows.map((r,i)=><FunnelStep key={r.label} label={r.label} value={r.value} base={base} rateValue={i?rate(r.value,rows[i-1]?.value):100} index={i}/>)}</article>
}

function SectionTitle({eyebrow,title,text}){
  return <div className="sx-section-title"><span>{eyebrow}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div>
}

export default function ExecutiveClean({data,onBack}){
  const business=data?.shopify?.business||[]
  const funnels=data?.funnel?.months||[]
  const [selected,setSelected]=useState(business.at(-1)?.month_start||'')
  const [trendView,setTrendView]=useState('business')
  const [mediaView,setMediaView]=useState('cost')

  const current=business.find(x=>x.month_start===selected)||business.at(-1)
  if(!current)return <div className="sx-empty">Sem dados consolidados para o relatório.</div>

  const idx=business.findIndex(x=>x.month_start===current.month_start)
  const previous=idx>0?business[idx-1]:null
  const fmap=useMemo(()=>new Map(funnels.map(x=>[x.month_start,x])),[funnels])
  const fm=fmap.get(current.month_start)||{}, pf=previous?fmap.get(previous.month_start)||{}:{}
  const labels=business.map(x=>shortMonth(x.month_start))

  const revenue=safe(current.shopify_revenue), orders=safe(current.shopify_orders), spend=safe(current.meta_spend), sessions=safe(current.sessions)
  const ticket=orders?revenue/orders:0, cac=orders?spend/orders:0, cvr=safe(current.conversion_rate)*100
  const prevCac=safe(previous?.shopify_orders)?safe(previous.meta_spend)/safe(previous.shopify_orders):0
  const revenueDelta=d(revenue,previous?.shopify_revenue), ordersDelta=d(orders,previous?.shopify_orders), spendDelta=d(spend,previous?.meta_spend)
  const cacDelta=d(cac,prevCac), merDelta=d(current.mer,previous?.mer), cvrDelta=d(current.conversion_rate,previous?.conversion_rate)

  const stageRates=[['Clique → página',safe(fm.click_to_lpv)],['Página → carrinho',safe(fm.lpv_to_cart)],['Carrinho → checkout',safe(fm.cart_to_checkout)],['Checkout → compra',safe(fm.checkout_to_purchase)]].filter(x=>x[1]>0).sort((a,b)=>a[1]-b[1])
  const weakest=stageRates[0]

  const metaRows=[{label:'Cliques no link',value:fm.link_clicks},{label:'Landing pages',value:fm.landing_page_views},{label:'Carrinhos',value:fm.adds_to_cart},{label:'Checkout',value:fm.initiates_checkout},{label:'Compras',value:fm.purchases}]
  const shopRows=[{label:'Sessões',value:current.sessions},{label:'Carrinhos',value:current.cart_additions},{label:'Checkout',value:current.reached_checkout},{label:'Compras',value:current.completed_checkout||current.shopify_orders}]

  const businessDatasets = trendView==='business' ? [
    {label:'Receita',data:business.map(x=>safe(x.shopify_revenue)),borderColor:purple,backgroundColor:'rgba(75,40,92,.09)',fill:true,tension:.38,borderWidth:2.5,pointRadius:2.5,pointHoverRadius:6},
    {label:'Investimento',data:business.map(x=>safe(x.meta_spend)),borderColor:lilac,backgroundColor:'transparent',tension:.38,borderWidth:2,pointRadius:2,pointHoverRadius:5}
  ] : [
    {label:'MER',data:business.map(x=>safe(x.mer)),borderColor:purple,backgroundColor:'rgba(75,40,92,.08)',fill:true,tension:.38,borderWidth:2.5,pointRadius:2.5,pointHoverRadius:6},
    {label:'ROAS Meta',data:business.map(x=>safe(x.meta_roas)),borderColor:mauve,backgroundColor:'transparent',tension:.38,borderWidth:2,pointRadius:2,pointHoverRadius:5}
  ]

  const mediaDatasets = mediaView==='cost' ? [
    {label:'CPM',data:business.map(x=>safe(fmap.get(x.month_start)?.cpm)),borderColor:purple,tension:.38,borderWidth:2.5,pointRadius:2.5,pointHoverRadius:6},
    {label:'CPC',data:business.map(x=>safe(fmap.get(x.month_start)?.cpc)),borderColor:rose,tension:.38,borderWidth:2,pointRadius:2,pointHoverRadius:5}
  ] : [
    {label:'CTR',data:business.map(x=>safe(fmap.get(x.month_start)?.ctr)),borderColor:green,tension:.38,borderWidth:2.5,pointRadius:2.5,pointHoverRadius:6},
    {label:'Frequência',data:business.map(x=>safe(fmap.get(x.month_start)?.frequency)),borderColor:mauve,tension:.38,borderWidth:2,pointRadius:2,pointHoverRadius:5}
  ]

  return <main className="skin-x-report">
    <button className="sx-back" onClick={onBack}>← Painel</button>

    <section className="sx-hero">
      <div className="sx-hero-copy"><span>RELATÓRIO GERENCIAL</span><h1>Performance da operação</h1><p>Shopify como verdade comercial. Meta como leitura de mídia, atribuição e eficiência.</p></div>
      <div className="sx-hero-side"><label><span>PERÍODO</span><select value={current.month_start} onChange={e=>setSelected(e.target.value)}>{business.slice().reverse().map(x=><option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></label><div className="sx-hero-revenue"><small>Receita</small><strong>{money(revenue)}</strong><p>{integer(orders)} pedidos · ticket {money(ticket)}</p></div></div>
    </section>

    <section className="sx-page sx-summary">
      <SectionTitle eyebrow="VISÃO DO MÊS" title="O que importa agora" text="Uma leitura executiva com negócio, eficiência e qualidade do tráfego no mesmo contexto."/>
      <div className="sx-kpi-grid">
        <KPI label="Receita" value={money(revenue)} change={revenueDelta} tone="hero" sub="Shopify"/>
        <KPI label="Pedidos" value={integer(orders)} change={ordersDelta} sub={`Ticket ${money(ticket)}`}/>
        <KPI label="Investimento" value={money(spend)} change={spendDelta} inverse sub="Meta Ads"/>
        <KPI label="CAC blended" value={money(cac)} change={cacDelta} inverse/>
        <KPI label="MER" value={num(current.mer)} change={merDelta}/>
        <KPI label="ROAS Meta" value={num(current.meta_roas)} change={d(current.meta_roas,previous?.meta_roas)}/>
        <KPI label="Conversão" value={pct(cvr)} change={cvrDelta}/>
        <KPI label="Sessões" value={integer(sessions)} change={d(sessions,previous?.sessions)}/>
      </div>

      <div className="sx-signal-grid">
        <article><span>GARGALO PRINCIPAL</span><strong>{weakest?.[0]||'Sem gargalo confiável'}</strong><p>{weakest?`Taxa de passagem de ${pct(weakest[1])}.`:'Ainda faltam eventos suficientes para leitura segura.'}</p></article>
        <article><span>QUALIDADE DE MÍDIA</span><strong>CTR {pct(fm.ctr)}</strong><p>CPM {money(fm.cpm)} · CPC {money(fm.cpc)} · frequência {num(fm.frequency)}</p></article>
        <article><span>EFICIÊNCIA COMERCIAL</span><strong>{num(current.mer)} MER</strong><p>{money(cac)} por pedido real · conversão {pct(cvr)}</p></article>
      </div>
    </section>

    <section className="sx-page">
      <div className="sx-section-head"><SectionTitle eyebrow="01 · EVOLUÇÃO" title="Negócio em movimento" text="Troque a visão para enxergar escala, investimento e eficiência sem misturar conceitos."/><div className="sx-tabs"><button className={trendView==='business'?'active':''} onClick={()=>setTrendView('business')}>Receita × mídia</button><button className={trendView==='efficiency'?'active':''} onClick={()=>setTrendView('efficiency')}>MER × ROAS</button></div></div>
      <div className="sx-chart-panel"><InteractiveChart labels={labels} datasets={businessDatasets} height={360} yFormat={trendView==='business'?'money':'number'}/></div>
      <div className="sx-submetrics">
        <div><span>Receita / sessão</span><strong>{money(sessions?revenue/sessions:0)}</strong></div>
        <div><span>Ticket médio</span><strong>{money(ticket)}</strong></div>
        <div><span>CAC blended</span><strong>{money(cac)}</strong></div>
        <div><span>Conversão site</span><strong>{pct(cvr)}</strong></div>
      </div>
    </section>

    <section className="sx-purple-wave">
      <div className="sx-page sx-purple-inner"><SectionTitle eyebrow="02 · FUNIL" title="Do clique à compra" text="Atribuição de mídia e comportamento comercial aparecem lado a lado para mostrar onde a intenção perde força."/>
        <div className="sx-funnel-grid"><Funnel title="Funil atribuído" subtitle="META ADS" rows={metaRows}/><Funnel title="Funil real" subtitle="SHOPIFY" rows={shopRows}/></div>
        <div className="sx-rate-ribbon"><div><span>Clique → LPV</span><strong>{pct(fm.click_to_lpv)}</strong></div><div><span>LPV → carrinho</span><strong>{pct(fm.lpv_to_cart)}</strong></div><div><span>Carrinho → checkout</span><strong>{pct(fm.cart_to_checkout)}</strong></div><div><span>Checkout → compra</span><strong>{pct(fm.checkout_to_purchase)}</strong></div></div>
      </div>
    </section>

    <section className="sx-page">
      <div className="sx-section-head"><SectionTitle eyebrow="03 · MÍDIA" title="Custo e atenção" text="Alterne entre custo de entrega e qualidade de atenção. Passe o mouse pelos gráficos para ler cada ponto."/><div className="sx-tabs"><button className={mediaView==='cost'?'active':''} onClick={()=>setMediaView('cost')}>CPM × CPC</button><button className={mediaView==='attention'?'active':''} onClick={()=>setMediaView('attention')}>CTR × frequência</button></div></div>
      <div className="sx-media-layout"><div className="sx-chart-panel"><InteractiveChart labels={labels} datasets={mediaDatasets} height={320} yFormat={mediaView==='attention'?'number':'money'}/></div><div className="sx-media-side"><KPI label="CPM" value={money(fm.cpm)} change={d(fm.cpm,pf.cpm)} inverse/><KPI label="CPC" value={money(fm.cpc)} change={d(fm.cpc,pf.cpc)} inverse/><KPI label="CTR" value={pct(fm.ctr)} change={d(fm.ctr,pf.ctr)}/><KPI label="Frequência" value={num(fm.frequency)} change={d(fm.frequency,pf.frequency)}/></div></div>
    </section>

    <section className="sx-page sx-data-dense">
      <SectionTitle eyebrow="04 · DETALHE" title="Leitura completa do período" text="Mais contexto para gestão, sem esconder os indicadores operacionais que explicam os KPIs principais."/>
      <div className="sx-detail-grid">
        <div><span>Impressões</span><strong>{integer(fm.impressions)}</strong></div><div><span>Alcance</span><strong>{integer(fm.reach)}</strong></div><div><span>Cliques</span><strong>{integer(fm.clicks||fm.link_clicks)}</strong></div><div><span>Landing page views</span><strong>{integer(fm.landing_page_views)}</strong></div><div><span>Adições ao carrinho</span><strong>{integer(fm.adds_to_cart)}</strong></div><div><span>Checkouts iniciados</span><strong>{integer(fm.initiates_checkout)}</strong></div><div><span>Compras Meta</span><strong>{integer(fm.purchases)}</strong></div><div><span>Compras Shopify</span><strong>{integer(current.completed_checkout||current.shopify_orders)}</strong></div>
      </div>
    </section>
  </main>
}
