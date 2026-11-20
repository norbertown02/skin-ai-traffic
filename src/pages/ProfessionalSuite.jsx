import React, { useState } from 'react'
import { PageHeader, Surface, Badge } from '../components/UI.jsx'
import { integer, money, num, pct, delta, cleanAdName } from '../lib/format.js'
const n=v=>Number(v||0)
const fmt=(v,f)=>v==null?'—':f(v)
const per=(a,b)=>n(b)>0?100*n(a)/n(b):null
const d=v=>v?v.split('-').reverse().join('/'):'—'
function Kpi({label,value,detail,change}){
 return <article className="ps-kpi"><span>{label}</span><strong>{value}</strong><small>{detail}</small>{change&&<em>{change}</em>}</article>
}
function Stage({label,value,base}){
 const width=base?Math.min(100,Math.max(0,100*n(value)/n(base))):0
 return <div className="ps-stage"><div><span>{label}</span><strong>{integer(value)}</strong></div><div className="ps-stage-bar"><i style={{width:width+'%'}}/></div><small>{base?pct(per(value,base)):'—'} da etapa anterior</small></div>
}
export function Cockpit({data,workspace,onNavigate}){
 const metric=data?.bootstrap?.performance?.periods?.current??{}
 const previous=data?.bootstrap?.performance?.periods?.previous
 const compare=data?.bootstrap?.performance?.comparison
 const period=data?.bootstrap?.main?.period??{}
 const current=(data?.shopify?.business??[]).at(-1)
 const checks=data?.manager?.quality??[]
 const warnings=checks.filter(x=>x.status!=='ok')
 const profiles=(data?.deep?.creative_profiles??[]).filter(x=>x.delivered)
 const candidate=profiles.filter(x=>n(x.metrics?.purchases)>=3&&n(x.metrics?.spend)>=50).sort((a,b)=>n(b.metrics?.roas)-n(a.metrics?.roas))[0]
 const danger=profiles.filter(x=>n(x.metrics?.spend)>=60&&!n(x.metrics?.purchases)).sort((a,b)=>n(b.metrics?.spend)-n(a.metrics?.spend))[0]
 const pending=(workspace?.items??[]).filter(x=>['planned','running','validating'].includes(x.status)).length
 const change=(a,b)=>{const x=delta(a,b);return x==null?'Sem base anterior':(x>0?'+':'')+num(x,1)+'% vs anterior'}
 return <div className="page pro-page ps-page">
 <PageHeader eyebrow="CENTRAL DE PERFORMANCE" title="Painel de comando" description="Mídia, resultado comercial, confiabilidade dos números e prioridades — sem confundir atribuição com lucro."/>
 <p className="ps-help">{d(period.start)} a {d(period.end)} · {compare?.available?'comparável com '+d(compare.start)+' a '+d(compare.end):'janela anterior indisponível'}</p>
 <div className="ps-kpis">
 <Kpi label="Investimento Meta" value={money(metric.spend)} detail="Gasto no período" change={previous&&change(metric.spend,previous.spend)}/>
 <Kpi label="Compras Meta" value={integer(metric.purchases)} detail="Conversões atribuídas" change={previous&&change(metric.purchases,previous.purchases)}/>
 <Kpi label="ROAS atribuído" value={fmt(metric.roas,num)} detail="Não equivale a lucro" change={previous&&change(metric.roas,previous.roas)}/>
 <Kpi label="Receita Shopify" value={current?.has_shopify?money(current.shopify_revenue):'—'} detail={current?.has_shopify?'Janela comercial alinhada':'Sem janela comercial equivalente'}/>
 <Kpi label="MER" value={current?.has_shopify?fmt(current.mer,num):'—'} detail="Receita da loja ÷ mídia Meta"/>
 <Kpi label="Conversão Shopify" value={current?.has_shopify?pct(n(current.conversion_rate)*100):'—'} detail="Sessões convertidas ÷ sessões"/>
 </div>
 <div className="ps-columns">
 <Surface eyebrow="PRIORIDADES" title="O que investigar">
  <div className="ps-actions">
    <button onClick={()=>onNavigate('integrations')}><strong>Qualidade das fontes</strong><span>{warnings.length} alerta(s) de cobertura e rastreamento</span></button>
    <button onClick={()=>onNavigate('funnel')}><strong>Funil e checkout</strong><span>Separar a jornada Shopify dos eventos Meta</span></button>
    <button onClick={()=>onNavigate('creatives')}><strong>Gasto sem compras</strong><span>{danger?cleanAdName(danger.name)+' · '+money(danger.metrics.spend):'Sem alertas acima de R$ 60 neste filtro'}</span></button>
    <button onClick={()=>onNavigate('experiments')}><strong>Testes e decisões</strong><span>{pending} pendente(s) de validação ou conclusão</span></button>
  </div>
 </Surface>
 <Surface eyebrow="DADOS" title="Confiabilidade da leitura">
  <div className="ps-checks">{checks.map((check,i)=><div key={i}><Badge tone={check.status==='ok'?'success':'warning'}>{check.status==='ok'?'OK':'Verificar'}</Badge><strong>{check.name}</strong><p>{check.message}</p></div>)}</div>
 </Surface></div>
 <div className="ps-columns">
  <Surface eyebrow="CRIATIVOS" title="Candidato com amostra"><h3>{candidate?cleanAdName(candidate.name):'Sem volume suficiente'}</h3><p>{candidate?integer(candidate.metrics.purchases)+' compras · ROAS '+num(candidate.metrics.roas)+' · gasto '+money(candidate.metrics.spend):'Um sinal precisa de múltiplas compras e margem validada antes de orientar escala.'}</p><button className="btn" onClick={()=>onNavigate('creatives')}>Ver criativos</button></Surface>
  <Surface eyebrow="RENTABILIDADE" title="A escala precisa ser sustentável"><p>O ROI atribuído não inclui impostos, custo de produto, frete ou taxas. Cadastre a economia por SKU para calcular a mídia sustentável.</p><button className="btn" onClick={()=>onNavigate('economics')}>Abrir custos e metas</button></Surface>
 </div>
 </div>
}
export function FunnelLab({data}){
 const business=data?.shopify?.business??[],monthly=data?.funnel?.months??[]
 const [choice,setChoice]=useState('')
 const selected=business.some(x=>x.month_start===choice)?choice:business.at(-1)?.month_start
 const shop=business.find(x=>x.month_start===selected), meta=monthly.find(x=>x.month_start===selected)
 const stepsMeta=[['Cliques no link',meta?.link_clicks],['Visualizações da página',meta?.landing_page_views],['Carrinhos atribuídos',meta?.adds_to_cart],['Checkouts atribuídos',meta?.initiates_checkout],['Compras atribuídas',meta?.purchases]]
 const stepsShop=[['Sessões na loja',shop?.sessions],['Sessões com carrinho',shop?.cart_additions],['Sessões no checkout',shop?.reached_checkout],['Sessões convertidas',shop?.completed_checkout]]
 const aligned=Boolean(shop?.has_shopify)
 return <div className="page pro-page ps-page"><PageHeader eyebrow="FUNIL E LOJA" title="Jornada até a compra" description="Meta e Shopify usam universos e modelos diferentes; estas etapas são apresentadas separadamente."/>
 <div className="ps-toolbar"><label>Mês no filtro<select value={selected||''} onChange={e=>setChoice(e.target.value)}>{business.slice().reverse().map(x=><option key={x.month_start} value={x.month_start}>{x.month_start.slice(5,7)+'/'+x.month_start.slice(0,4)}</option>)}</select></label><small>{d(shop?.start)} a {d(shop?.meta_through_date)}</small></div>
 {!aligned&&<p role="status" className="ps-warning">Não existe consolidação Shopify com datas equivalentes. A medição comercial ficou indisponível para evitar comparação incorreta.</p>}
 <div className="ps-columns"><Surface eyebrow="META ADS" title="Eventos atribuídos">{stepsMeta.map((x,i)=><Stage key={x[0]} label={x[0]} value={x[1]} base={i?stepsMeta[i-1][1]:stepsMeta[0][1]}/>)}</Surface><Surface eyebrow="SHOPIFY" title="Sessões reais">{aligned?stepsShop.map((x,i)=><Stage key={x[0]} label={x[0]} value={x[1]} base={i?stepsShop[i-1][1]:stepsShop[0][1]}/>):<p>Sem dados comerciais equivalentes.</p>}</Surface></div>
 <div className="ps-kpis"><Kpi label="CTR link Meta" value={fmt(meta?.link_ctr,pct)} detail="Entrega publicitária"/><Kpi label="Clique → LPV" value={fmt(meta?.click_to_lpv,pct)} detail="Evento Meta"/><Kpi label="Conversão Shopify" value={aligned?pct(n(shop.conversion_rate)*100):'—'} detail="Sessões convertidas"/><Kpi label="Checkouts sem conversão" value={aligned&&n(shop.reached_checkout)?pct(per(n(shop.reached_checkout)-n(shop.completed_checkout),shop.reached_checkout)):'—'} detail="Sinal agregado, não prova de causa"/></div>
 <Surface eyebrow="INVESTIGAÇÃO" title="Diagnóstico por etapa"><div className="ps-actions">
  <div><strong>Cliques sem chegada à página</strong><span>Verifique tempo de carregamento, redirecionamentos e LPV.</span></div>
  <div><strong>Sessões sem carrinho</strong><span>Revise aderência anúncio–oferta, confiança, produto e experiência mobile.</span></div>
  <div><strong>Checkout com baixa conclusão</strong><span>Audite frete, pagamentos, cupons, erros e usabilidade antes de mexer no orçamento.</span></div>
  <div><strong>Compras divergentes nas plataformas</strong><span>Compare mesmas datas, configuração de atribuição, UTMs e integridade dos eventos.</span></div>
 </div></Surface></div>
}
export function CompareMedia({data}){
 const [level,setLevel]=useState('ads'),[choiceA,setChoiceA]=useState(''),[choiceB,setChoiceB]=useState('')
 const main=data?.bootstrap?.main?.cur??{}
 const rows=(main[level]??[]).filter(x=>n(x.spend)>0).slice().sort((a,b)=>n(b.spend)-n(a.spend))
 const a=rows.find(x=>x.id===choiceA)??rows[0],b=rows.find(x=>x.id===choiceB)??rows[1]
 const prev=(data?.deep?.comparison??{})[level]??[]
 const previous=new Map(prev.map(x=>[x.id,x]))
 const cols=[['Investimento','spend',money],['Impressões','impressions',integer],['CTR link (%)','link_ctr',pct],['CPC link','link_cpc',money],['Compras Meta','purchases',integer],['Custo por compra','cac',money],['ROAS Meta','roas',num]]
 return <div className="page pro-page ps-page"><PageHeader eyebrow="COMPARADOR" title="Comparar estruturas" description="Anúncios, campanhas e conjuntos lado a lado, com o mesmo período e contexto. Não é um experimento randomizado."/>
 <div className="ps-toolbar"><label>Nível<select value={level} onChange={e=>{setLevel(e.target.value);setChoiceA('');setChoiceB('')}}><option value="ads">Anúncios</option><option value="sets">Conjuntos</option><option value="campaigns">Campanhas</option></select></label>
 <label>Estrutura A<select value={a?.id??''} onChange={e=>setChoiceA(e.target.value)}>{rows.map(x=><option key={x.id} value={x.id}>{cleanAdName(x.name)+' · '+money(x.spend)}</option>)}</select></label>
 <label>Estrutura B<select value={b?.id??''} onChange={e=>setChoiceB(e.target.value)}>{rows.map(x=><option key={x.id} value={x.id}>{cleanAdName(x.name)+' · '+money(x.spend)}</option>)}</select></label>
 </div>
 {a&&b?<Surface eyebrow="MÉTRICAS" title="Resultado comparável"><div className="table-wrap"><table><thead><tr><th>Indicador</th><th>{cleanAdName(a.name)}</th><th>{cleanAdName(b.name)}</th></tr></thead><tbody>{cols.map(([label,key,format])=><tr key={key}><th>{label}</th><td>{fmt(a[key],format)}</td><td>{fmt(b[key],format)}</td></tr>)}</tbody></table></div>
 {previous.size>0&&<div><h3>Janela anterior equivalente</h3><div className="table-wrap"><table><thead><tr><th>Estrutura</th><th>Gasto antes</th><th>Compras antes</th><th>ROAS antes</th></tr></thead><tbody>{[a,b].map(x=><tr key={x.id}><th>{cleanAdName(x.name)}</th><td>{fmt(previous.get(x.id)?.spend,money)}</td><td>{fmt(previous.get(x.id)?.purchases,integer)}</td><td>{fmt(previous.get(x.id)?.roas,num)}</td></tr>)}</tbody></table></div></div>}
 <p className="ps-help">Diferenças entre públicos e objetivos podem explicar os resultados. Não alteramos nenhum anúncio por esta tela.</p></Surface>:<p role="status">Selecione um período com pelo menos dois itens com entrega.</p>}
 </div>
}