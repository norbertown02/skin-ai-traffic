import React, { useMemo, useState } from 'react'
import { delta, integer, money, monthLabel, num, pct, rate, shortMonth } from '../lib/format.js'

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const safe=n=>Number(n||0)
const d=(a,b)=>delta(a,b)

function Change({value,inverse=false}){
  if(value===null||value===undefined||Number.isNaN(Number(value))) return <span className="er-change neutral">—</span>
  const n=Number(value), good=inverse?n<0:n>0
  return <span className={`er-change ${n===0?'neutral':good?'good':'bad'}`}>{n>0?'+':''}{num(n,1)}%</span>
}

function Stat({label,value,change,inverse=false,caption}){
  return <div className="er-stat"><div className="er-stat-top"><span>{label}</span><Change value={change} inverse={inverse}/></div><strong>{value}</strong>{caption&&<small>{caption}</small>}</div>
}

function LineChart({labels,series,height=310}){
  const width=1000,padX=34,padTop=22,padBottom=42, plotH=height-padTop-padBottom, plotW=width-padX*2
  const values=series.flatMap(s=>s.data.map(safe)); const max=Math.max(...values,1); const min=Math.min(...values,0)
  const range=Math.max(max-min,1)
  const x=i=>padX+(labels.length<=1?plotW/2:(i/(labels.length-1))*plotW)
  const y=v=>padTop+plotH-(safe(v)-min)/range*plotH
  const path=data=>data.map((v,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return <div className="er-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img">
    {[0,.5,1].map((t,i)=><line key={i} x1={padX} x2={width-padX} y1={padTop+plotH*t} y2={padTop+plotH*t} className="er-gridline"/>) }
    {series.map((s,si)=><g key={s.label}><path d={path(s.data)} fill="none" stroke={s.color} strokeWidth={si===0?4:3} strokeLinecap="round" strokeLinejoin="round" opacity={si===0?1:.8}/>{s.data.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r={i===s.data.length-1?5:2.5} fill={s.color}/>)}</g>)}
    {labels.map((l,i)=><text key={l+i} x={x(i)} y={height-10} textAnchor="middle" className="er-axis-label">{l}</text>)}
  </svg><div className="er-legend">{series.map(s=><span key={s.label}><i style={{background:s.color}}/>{s.label}</span>)}</div></div>
}

function Bars({labels,values}){
  const max=Math.max(...values.map(safe),1)
  return <div className="er-bars">{values.map((v,i)=><div className="er-bar-item" key={labels[i]}><div className="er-bar-rail"><i style={{height:`${clamp(safe(v)/max*100,3,100)}%`}}/></div><span>{labels[i]}</span></div>)}</div>
}

function Funnel({title,eyebrow,rows}){
  const top=Math.max(safe(rows[0]?.value),1)
  return <div className="er-funnel"><div className="er-funnel-head"><span>{eyebrow}</span><h3>{title}</h3></div><div className="er-funnel-list">{rows.map((r,i)=>{const value=safe(r.value), ratio=i===0?100:rate(value,rows[i-1]?.value||0);return <div className="er-funnel-row" key={r.label}><div className="er-funnel-number">0{i+1}</div><div className="er-funnel-copy"><span>{r.label}</span><strong>{integer(value)}</strong></div><div className="er-funnel-track"><i style={{width:`${clamp(value/top*100,3,100)}%`}}/></div><em>{i===0?'base':pct(ratio)}</em></div>})}</div></div>
}

function SectionIntro({number,kicker,title,text,dark=false}){
  return <div className={`er-section-intro ${dark?'dark':''}`}><span className="er-section-number">{number}</span><div><small>{kicker}</small><h2>{title}</h2>{text&&<p>{text}</p>}</div></div>
}

export default function ExecutiveClean({data,onBack}){
  const business=data?.shopify?.business||[], funnels=data?.funnel?.months||[]
  const [selected,setSelected]=useState(business.at(-1)?.month_start||'')
  const current=business.find(x=>x.month_start===selected)||business.at(-1)
  if(!current)return <div className="er-empty">Sem dados consolidados para o relatório.</div>
  const index=business.findIndex(x=>x.month_start===current.month_start), previous=index>0?business[index-1]:null
  const funnelMap=useMemo(()=>new Map(funnels.map(x=>[x.month_start,x])),[funnels]); const fm=funnelMap.get(current.month_start)||{}, pf=previous?funnelMap.get(previous.month_start)||{}:{}
  const labels=business.map(x=>shortMonth(x.month_start))
  const revenue=safe(current.shopify_revenue), orders=safe(current.shopify_orders), spend=safe(current.meta_spend), sessions=safe(current.sessions)
  const cac=orders?spend/orders:0, ticket=orders?revenue/orders:0, cvr=safe(current.conversion_rate)*100
  const prevCac=safe(previous?.shopify_orders)?safe(previous?.meta_spend)/safe(previous?.shopify_orders):0
  const revenueDelta=d(revenue,previous?.shopify_revenue), ordersDelta=d(orders,previous?.shopify_orders), spendDelta=d(spend,previous?.meta_spend), cacDelta=d(cac,prevCac), merDelta=d(current.mer,previous?.mer), cvrDelta=d(current.conversion_rate,previous?.conversion_rate)
  const stageRates=[['Clique → página',safe(fm.click_to_lpv)],['Página → carrinho',safe(fm.lpv_to_cart)],['Carrinho → checkout',safe(fm.cart_to_checkout)],['Checkout → compra',safe(fm.checkout_to_purchase)]].filter(x=>x[1]>0).sort((a,b)=>a[1]-b[1]); const weakest=stageRates[0]
  const revenueUp=Number(revenueDelta||0)>=0, efficiencyUp=Number(merDelta||0)>=0

  const metaRows=[{label:'Cliques no link',value:fm.link_clicks},{label:'Visualizações da página',value:fm.landing_page_views},{label:'Carrinhos',value:fm.adds_to_cart},{label:'Checkout',value:fm.initiates_checkout},{label:'Compras',value:fm.purchases}]
  const shopRows=[{label:'Sessões',value:current.sessions},{label:'Carrinhos',value:current.cart_additions},{label:'Checkout',value:current.reached_checkout},{label:'Compras',value:current.completed_checkout||current.shopify_orders}]

  return <main className="editorial-report">
    <button className="er-back" onClick={onBack}>← Voltar ao painel</button>

    <section className="er-hero">
      <div className="er-hero-top"><div className="er-wordmark"><strong>Skin Beauty</strong><span>Performance intelligence</span></div><label className="er-period"><span>PERÍODO</span><select value={current.month_start} onChange={e=>setSelected(e.target.value)}>{business.slice().reverse().map(x=><option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></label></div>
      <div className="er-hero-copy"><span>RELATÓRIO GERENCIAL</span><h1>Performance<br/><em>em movimento.</em></h1><p>Uma leitura visual da operação: resultado comercial real da Shopify, eficiência da mídia e o caminho entre atenção e compra.</p></div>
      <div className="er-hero-footer"><div><span>Receita do período</span><strong>{money(revenue)}</strong></div><p>{integer(orders)} pedidos · ticket médio {money(ticket)} · conversão {pct(cvr)}</p></div>
    </section>

    <section className="er-paper er-overview">
      <div className="er-overview-heading"><span>VISÃO DO MÊS</span><h2>{monthLabel(current.month_start)}</h2><p>Os números principais sem ruído. Comparação direta com o período anterior.</p></div>
      <div className="er-stat-wall"><Stat label="Receita" value={money(revenue)} change={revenueDelta}/><Stat label="Pedidos" value={integer(orders)} change={ordersDelta}/><Stat label="Investimento" value={money(spend)} change={spendDelta} inverse/><Stat label="CAC blended" value={money(cac)} change={cacDelta} inverse/><Stat label="MER" value={num(current.mer)} change={merDelta}/><Stat label="Conversão" value={pct(cvr)} change={cvrDelta}/></div>
      <div className="er-editorial-read">
        <div className="er-read-main"><span>LEITURA EXECUTIVA</span><h3>{revenueUp?'A operação ganhou receita.':'A receita perdeu força.'}<br/>{efficiencyUp?'A eficiência acompanhou.':'A eficiência precisa de atenção.'}</h3></div>
        <div className="er-read-notes"><p><strong>Negócio.</strong> {previous?`Receita ${revenueUp?'acima':'abaixo'} de ${monthLabel(previous.month_start)} em ${num(Math.abs(Number(revenueDelta||0)),1)}%.`:'Ainda não existe base anterior suficiente para comparação.'}</p><p><strong>Funil.</strong> {weakest?`${weakest[0]} é hoje a passagem mais frágil, com ${pct(weakest[1])}.`:'Os eventos disponíveis ainda não permitem identificar um gargalo confiável.'}</p><p><strong>Mídia.</strong> CPM em {money(fm.cpm)}, CPC em {money(fm.cpc)}, CTR de {pct(fm.ctr)} e frequência {num(fm.frequency)}.</p></div>
      </div>
    </section>

    <section className="er-paper er-growth">
      <SectionIntro number="01" kicker="NEGÓCIO" title="Crescer é diferente de gastar mais." text="O ponto aqui é enxergar escala e eficiência no mesmo quadro, sem confundir receita real com atribuição de plataforma."/>
      <div className="er-feature-chart"><div className="er-chart-heading"><span>RECEITA SHOPIFY</span><strong>{money(revenue)}</strong><small>evolução mensal</small></div><LineChart labels={labels} series={[{label:'Receita',color:'#4a215f',data:business.map(x=>safe(x.shopify_revenue))},{label:'Investimento',color:'#b59abf',data:business.map(x=>safe(x.meta_spend))}]} height={340}/></div>
      <div className="er-split-story"><div><span className="er-kicker">VOLUME</span><h3>Pedidos versus CAC</h3><p>Quando o volume sobe e o CAC não acompanha na mesma proporção, a operação está ganhando qualidade.</p><LineChart labels={labels} series={[{label:'CAC',color:'#4a215f',data:business.map(x=>safe(x.shopify_orders)?safe(x.meta_spend)/safe(x.shopify_orders):0)}]} height={235}/></div><div><span className="er-kicker">EFICIÊNCIA</span><h3>MER versus ROAS Meta</h3><p>MER usa a receita comercial real; ROAS Meta mostra somente a receita atribuída pela plataforma.</p><LineChart labels={labels} series={[{label:'MER',color:'#4a215f',data:business.map(x=>safe(x.mer))},{label:'ROAS Meta',color:'#9d83a8',data:business.map(x=>safe(x.meta_roas))}]} height={235}/></div></div>
    </section>

    <section className="er-purple">
      <SectionIntro dark number="02" kicker="FUNIL" title="Onde a intenção se perde." text="A mídia cria movimento. O relatório mostra em qual passagem esse movimento deixa de avançar."/>
      <div className="er-funnel-stage"><Funnel eyebrow="META ADS" title="Funil atribuído" rows={metaRows}/><Funnel eyebrow="SHOPIFY" title="Funil real da loja" rows={shopRows}/></div>
      <div className="er-funnel-insight"><span>MAIOR PONTO DE ATRITO</span><strong>{weakest?.[0]||'Sem gargalo definido'}</strong><p>{weakest?`Apenas ${pct(weakest[1])} avança nessa passagem. Esse é o primeiro ponto que merece investigação antes de aumentar investimento.`:'Ainda não há volume de eventos suficiente para uma leitura confiável.'}</p></div>
    </section>

    <section className="er-paper er-media">
      <SectionIntro number="03" kicker="MÍDIA" title="O preço da atenção." text="CPM, CPC, CTR e frequência ajudam a separar problema de leilão, problema de criativo e pressão de repetição."/>
      <div className="er-media-numbers"><Stat label="CPM" value={money(fm.cpm)} change={d(fm.cpm,pf.cpm)} inverse caption="custo por mil impressões"/><Stat label="CPC" value={money(fm.cpc)} change={d(fm.cpc,pf.cpc)} inverse caption="custo por clique"/><Stat label="CTR" value={pct(fm.ctr)} change={d(fm.ctr,pf.ctr)} caption="taxa de clique"/><Stat label="Frequência" value={num(fm.frequency)} change={d(fm.frequency,pf.frequency)} caption="repetição média"/></div>
      <div className="er-media-visual"><div className="er-media-bars"><span className="er-kicker">CTR — HISTÓRICO</span><Bars labels={labels} values={business.map(x=>safe(funnelMap.get(x.month_start)?.ctr))}/></div><div className="er-media-comment"><span>LEITURA</span><h3>{safe(fm.ctr)>=safe(pf.ctr)?'A atenção está sustentada.':'A atenção perdeu força.'}</h3><p>{safe(fm.cpm)>safe(pf.cpm)?'O CPM também está mais alto, então parte da pressão pode estar vindo do leilão.':'O custo de entrega não mostra uma pressão relevante frente ao período anterior.'}</p></div></div>
    </section>

    <section className="er-closing"><div><span>SKIN BEAUTY · PERFORMANCE</span><h2>No flow<br/>dos seus dados.</h2></div><p>Relatório gerencial · {monthLabel(current.month_start)}</p></section>
  </main>
}
