import React, { useEffect, useState } from 'react'
import { api, endpoints } from '../api.js'
import { HorizontalBars } from '../components/Charts.jsx'
import { DataTable, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'
import { classifyFunnelContext, stageLabel } from '../lib/funnelContext.js'
const n=v=>Number(v||0)
const sort=(r,k='spend')=>(r||[]).slice().sort((a,b)=>n(b[k])-n(a[k]))
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
export default function AudienceDeep({data,onNavigate}){
 const [range,setRange]=useState('30')
 const [year,setYear]=useState(String(new Date().getFullYear()))
 const [start,setStart]=useState('')
 const [end,setEnd]=useState('')
 const [filtered,setFiltered]=useState(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const today=new Date().toISOString().slice(0,10), currentYear=new Date().getFullYear()
 const from=range==='year'?`${year}-01-01`:range==='custom'?start:''
 const until=range==='year'?(Number(year)===currentYear?today:`${year}-12-31`):range==='custom'?end:today
 const days=from&&until?Math.floor((Date.parse(until+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1:Number(range)
 const invalid=range==='custom'&&(!start||!end||start>end||end>today)
 useEffect(()=>{
   if(range==='30'){setFiltered(null);setError('');setLoading(false);return}
   if(invalid||days<1){setFiltered(null);setError('Escolha um intervalo válido para consultar os públicos.');return}
   let active=true
   const params=new URLSearchParams({days:String(days)})
   if(from){params.set('since',from);params.set('until',until);params.set('start_date',from);params.set('end_date',until)}
   const requestUrl=(url)=>`${url.split('?')[0]}?${url.includes('action=bootstrap')?'action=bootstrap&':''}${params.toString()}`
   setLoading(true);setFiltered(null);setError('')
   Promise.all([api(requestUrl(endpoints.bootstrap)),api(requestUrl(endpoints.audience))])
     .then(([bootstrap,audience])=>{
       if(!active)return
       const dates=(bootstrap?.performance?.daily||[]).map(x=>String(x.date||'').slice(0,10)).filter(Boolean).sort()
       if(from&&dates.length&&dates[0]>from){
         setError(`A API retornou histórico a partir de ${dates[0]}, e não desde ${from}. Não é possível confirmar a análise anual completa sem ampliar a API no Supabase.`)
         return
       }
       setFiltered({bootstrap,audience})
     })
     .catch(e=>{if(active)setError(e.message||'Falha ao consultar o período.')})
     .finally(()=>{if(active)setLoading(false)})
   return ()=>{active=false}
 },[range,year,start,end])
 const source=filtered||data||{}
 const a=source.audience||{}, types=source.bootstrap?.main?.audienceSummary?.by_type||[], baseRows=source.bootstrap?.main?.audienceRows||[], rows=baseRows.map(r=>({...r,_funnel:classifyFunnelContext(r)}))
 const intervalLabel=range==='year'?`Ano ${year}`:range==='custom'?`${start} até ${end}`:`Últimos ${range} dias`
 const bestAge=sort((a.by_age||[]).filter(x=>n(x.spend)>0),'roas')[0], bestGender=sort((a.by_gender||[]).filter(x=>n(x.spend)>0),'roas')[0], topType=sort(types.filter(x=>n(x.spend)>0),'roas')[0]
 const stageSpend=['top','middle','bottom','customer','mixed','unknown'].map(key=>({key:stageLabel(key),spend:rows.filter(x=>x._funnel.stage===key).reduce((s,x)=>s+n(x.spend),0)})).filter(x=>x.spend>0)
 return <div className="page deep-page"><PageHeader eyebrow="PÚBLICOS" title="Inteligência de audiência" description="A audiência é a principal fonte da classificação de Topo, Meio e Fundo. O criativo mantém sua função de mensagem; o funil vem do contexto de entrega."/>
 <div style={{display:"flex",justifyContent:"flex-end",paddingTop:8}}><button className="btn primary" type="button" onClick={()=>onNavigate?.("analysis")}>Abrir análise detalhada →</button></div>
 <div className="analysis-period-filter" style={{display:'flex',alignItems:'end',gap:12,flexWrap:'wrap',padding:'16px 0'}}>
  <label>Período <select value={range} onChange={e=>setRange(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 6 meses</option><option value="year">Ano inteiro</option><option value="custom">Personalizado</option></select></label>
  {range==='year'&&<label>Ano <select value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:5},(_,i)=>currentYear-i).map(y=><option value={y} key={y}>{y}</option>)}</select></label>}
  {range==='custom'&&<><label>Início <input type="date" value={start} max={today} onChange={e=>setStart(e.target.value)}/></label><label>Fim <input type="date" value={end} max={today} onChange={e=>setEnd(e.target.value)}/></label></>}
  <small>{intervalLabel}</small>
 </div>
 {loading&&<p role="status">Carregando dados de públicos para o período…</p>}
 {error&&<p role="alert" style={{color:'#9d3a43',fontWeight:600}}>{error} Os indicadores abaixo permanecem no último período confirmado.</p>}
 <div className="deep-metric-grid five"><Metric label="Gasto" value={money(a.total?.spend)}/><Metric label="Compras" value={integer(a.total?.purchases)}/><Metric label="ROAS" value={num(a.total?.roas)}/><Metric label="CAC" value={money(a.total?.cac)}/><Metric label="CTR" value={pct(a.total?.ctr)}/></div>
 <SectionHeader number="01" eyebrow="FUNIL" title="Onde a verba está sendo entregue" description="Topo = prospecção; Meio = visitantes/engajados; Fundo = carrinho/checkout. Estruturas Advantage+ mistas permanecem separadas."/>
 <div className="deep-two"><HorizontalBars title="Gasto por estágio" rows={stageSpend} valueKey="spend" formatValue={money}/><HorizontalBars title="Gasto por estratégia de público" rows={types} valueKey="spend" formatValue={money}/></div>
 <SectionHeader number="02" eyebrow="DISTRIBUIÇÃO" title="Quem recebe a verba" description="Distribuição por idade e gênero para comparar pressão de investimento com volume de compra."/>
 <div className="deep-two"><HorizontalBars title="Gasto por idade" rows={a.by_age||[]} valueKey="spend" formatValue={money}/><HorizontalBars title="Compras por idade" rows={a.by_age||[]} valueKey="purchases" formatValue={integer}/></div>
 <div className="analysis-highlight-row"><Surface eyebrow="IDADE" title="Melhor retorno"><strong className="analysis-big">{bestAge?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestAge?.roas)} · CAC {money(bestAge?.cac)} · gasto {money(bestAge?.spend)}</p></Surface><Surface eyebrow="GÊNERO" title="Melhor eficiência"><strong className="analysis-big">{bestGender?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestGender?.roas)} · {integer(bestGender?.purchases)} compras</p></Surface><Surface eyebrow="ESTRATÉGIA" title="Melhor tipo de público"><strong className="analysis-big">{topType?.key||'—'}</strong><p className="muted-copy">ROAS {num(topType?.roas)} · CAC {money(topType?.cac)}</p></Surface></div>
 <SectionHeader number="03" eyebrow="CONFIGURAÇÃO" title="Conjuntos, targeting e funil" description="É aqui que o sistema determina a temperatura e o estágio. Sem targeting suficiente, não força uma classificação."/>
 <Surface><DataTable rows={sort(rows,'spend').slice(0,80)} columns={[{key:'name',label:'Conjunto'},{key:'_funnel',label:'Funil',render:r=>stageLabel(r._funnel.stage)},{key:'type',label:'Tipo'},{key:'age',label:'Idade'},{key:'gender',label:'Gênero'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>
}
