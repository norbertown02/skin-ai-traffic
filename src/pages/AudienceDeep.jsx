import React from 'react'
import { HorizontalBars } from '../components/Charts.jsx'
import { DataTable, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'
import { classifyFunnelContext, stageLabel } from '../lib/funnelContext.js'
const n=v=>Number(v||0)
const sort=(r,k='spend')=>(r||[]).slice().sort((a,b)=>n(b[k])-n(a[k]))
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
export default function AudienceDeep({data}){
 const a=data?.audience||{}, types=data?.bootstrap?.main?.audienceSummary?.by_type||[], baseRows=data?.bootstrap?.main?.audienceRows||[], rows=baseRows.map(r=>({...r,_funnel:classifyFunnelContext(r)}))
 const bestAge=sort((a.by_age||[]).filter(x=>n(x.spend)>0),'roas')[0], bestGender=sort((a.by_gender||[]).filter(x=>n(x.spend)>0),'roas')[0], topType=sort(types.filter(x=>n(x.spend)>0),'roas')[0]
 const stageSpend=['top','middle','bottom','customer','mixed','unknown'].map(key=>({key:stageLabel(key),spend:rows.filter(x=>x._funnel.stage===key).reduce((s,x)=>s+n(x.spend),0)})).filter(x=>x.spend>0)
 return <div className="page deep-page"><PageHeader eyebrow="PÚBLICOS" title="Inteligência de audiência" description="A audiência é a principal fonte da classificação de Topo, Meio e Fundo. O criativo mantém sua função de mensagem; o funil vem do contexto de entrega."/>
 <div className="deep-metric-grid five"><Metric label="Gasto" value={money(a.total?.spend)}/><Metric label="Compras" value={integer(a.total?.purchases)}/><Metric label="ROAS" value={num(a.total?.roas)}/><Metric label="CAC" value={money(a.total?.cac)}/><Metric label="CTR" value={pct(a.total?.ctr)}/></div>
 <SectionHeader number="01" eyebrow="FUNIL" title="Onde a verba está sendo entregue" description="Topo = prospecção; Meio = visitantes/engajados; Fundo = carrinho/checkout. Estruturas Advantage+ mistas permanecem separadas."/>
 <div className="deep-two"><HorizontalBars title="Gasto por estágio" rows={stageSpend} valueKey="spend" formatValue={money}/><HorizontalBars title="Gasto por estratégia de público" rows={types} valueKey="spend" formatValue={money}/></div>
 <SectionHeader number="02" eyebrow="DISTRIBUIÇÃO" title="Quem recebe a verba" description="Distribuição por idade e gênero para comparar pressão de investimento com volume de compra."/>
 <div className="deep-two"><HorizontalBars title="Gasto por idade" rows={a.by_age||[]} valueKey="spend" formatValue={money}/><HorizontalBars title="Compras por idade" rows={a.by_age||[]} valueKey="purchases" formatValue={integer}/></div>
 <div className="analysis-highlight-row"><Surface eyebrow="IDADE" title="Melhor retorno"><strong className="analysis-big">{bestAge?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestAge?.roas)} · CAC {money(bestAge?.cac)} · gasto {money(bestAge?.spend)}</p></Surface><Surface eyebrow="GÊNERO" title="Melhor eficiência"><strong className="analysis-big">{bestGender?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestGender?.roas)} · {integer(bestGender?.purchases)} compras</p></Surface><Surface eyebrow="ESTRATÉGIA" title="Melhor tipo de público"><strong className="analysis-big">{topType?.key||'—'}</strong><p className="muted-copy">ROAS {num(topType?.roas)} · CAC {money(topType?.cac)}</p></Surface></div>
 <SectionHeader number="03" eyebrow="CONFIGURAÇÃO" title="Conjuntos, targeting e funil" description="É aqui que o sistema determina a temperatura e o estágio. Sem targeting suficiente, não força uma classificação."/>
 <Surface><DataTable rows={sort(rows,'spend').slice(0,80)} columns={[{key:'name',label:'Conjunto'},{key:'_funnel',label:'Funil',render:r=>stageLabel(r._funnel.stage)},{key:'type',label:'Tipo'},{key:'age',label:'Idade'},{key:'gender',label:'Gênero'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>
}
