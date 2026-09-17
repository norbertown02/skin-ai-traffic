import React from 'react'
import { HorizontalBars } from '../components/Charts.jsx'
import { DataTable, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { cleanAdName, integer, money, num, pct } from '../lib/format.js'
const n=v=>Number(v||0)
const sort=(rows,key='spend')=>(rows||[]).slice().sort((a,b)=>n(b[key])-n(a[key]))
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
export default function EntityDeep({data,type}){
 const main=data?.bootstrap?.main||{}, cfg={campaign:['CAMPANHAS','Campanhas',main?.cur?.campaigns||[]],ad_set:['CONJUNTOS','Conjuntos',main?.cur?.sets||[]],ad:['ANÚNCIOS','Anúncios',main?.cur?.ads||[]]}[type]
 const rows=sort(cfg[2],'spend'), spend=rows.reduce((a,x)=>a+n(x.spend),0), purchases=rows.reduce((a,x)=>a+n(x.pur||x.purchases),0), revenue=rows.reduce((a,x)=>a+n(x.rev||x.revenue),0), clicks=rows.reduce((a,x)=>a+n(x.clicks),0), impressions=rows.reduce((a,x)=>a+n(x.imp||x.impressions),0)
 const roas=spend?revenue/spend:0, ctr=impressions?clicks/impressions*100:0, cpc=clicks?spend/clicks:0, cac=purchases?spend/purchases:0
 const best=rows.filter(x=>n(x.spend)>=20).slice().sort((a,b)=>n(b.roas)-n(a.roas))[0], biggest=rows[0]
 const displayName=x=>type==='ad'?cleanAdName(x?.name):x?.name||'—'
 return <div className="page deep-page"><PageHeader eyebrow={cfg[0]} title={`Performance de ${cfg[1].toLowerCase()}`} description="Visão operacional de concentração de verba, atenção, compras e retorno para priorizar onde investigar ou escalar."/>
 <div className="deep-metric-grid six"><Metric label="Investimento" value={money(spend)}/><Metric label="Compras" value={integer(purchases)}/><Metric label="ROAS" value={num(roas)}/><Metric label="CTR" value={pct(ctr)}/><Metric label="CPC" value={money(cpc)}/><Metric label="CAC" value={money(cac)}/></div>
 <div className="analysis-highlight-row"><Surface eyebrow="MAIOR VERBA" title="Maior concentração"><strong className="analysis-big">{displayName(biggest)}</strong><p className="muted-copy">Gasto {money(biggest?.spend)} · ROAS {num(biggest?.roas)}</p></Surface><Surface eyebrow="MELHOR RETORNO" title="Melhor item com amostra"><strong className="analysis-big">{displayName(best)}</strong><p className="muted-copy">ROAS {num(best?.roas)} · CAC {money(best?.cac)}</p></Surface><Surface eyebrow="COBERTURA" title="Itens com entrega"><strong className="analysis-big">{integer(rows.length)}</strong><p className="muted-copy">Itens com dados no período atual.</p></Surface></div>
 <SectionHeader number="01" eyebrow="CONCENTRAÇÃO" title="Onde a verba está sendo usada" description="Ranking de investimento para identificar dependência excessiva em poucas estruturas."/>
 <div className="deep-two"><HorizontalBars title="Gasto por item" rows={rows.map(x=>({key:displayName(x),spend:x.spend}))} valueKey="spend" formatValue={money}/><HorizontalBars title="ROAS por item" rows={rows.filter(x=>n(x.spend)>=20).map(x=>({key:displayName(x),roas:x.roas}))} valueKey="roas" formatValue={num}/></div>
 <SectionHeader number="02" eyebrow="DETALHE" title="Leitura operacional" description="Todos os principais indicadores juntos para localizar ganho de atenção, gargalo de tráfego ou perda no fundo do funil."/>
 <Surface><DataTable rows={rows.slice(0,100)} columns={[{key:'name',label:cfg[1].slice(0,-1),render:r=>displayName(r)},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'impressions',label:'Impressões',render:r=>integer(r.imp||r.impressions)},{key:'clicks',label:'Cliques',render:r=>integer(r.clicks)},{key:'ctr',label:'CTR',render:r=>pct(r.ctr)},{key:'cpc',label:'CPC',render:r=>money(r.cpc)},{key:'pur',label:'Compras',render:r=>integer(r.pur||r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>
}
