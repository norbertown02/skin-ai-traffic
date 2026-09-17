import React from 'react'
import { HorizontalBars } from '../components/Charts.jsx'
import { DataTable, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money } from '../lib/format.js'
const n=v=>Number(v||0)
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
export default function WasteDeep({data}){
 const w=data?.deep?.waste||{}, items=w.items||[]
 return <div className="page deep-page"><PageHeader eyebrow="DESPERDÍCIOS" title="Diagnóstico de perda de eficiência" description="Organiza sinais de gasto improdutivo por causa provável. Exposição potencial é ponto de investigação, não ordem automática de corte."/>
 <div className="deep-metric-grid five"><Metric label="Exposição potencial" value={money(w?.summary?.estimated_total)}/><Metric label="Público" value={integer(w?.summary?.counts?.audience_mismatch)}/><Metric label="Placement" value={integer(w?.summary?.counts?.placement_mismatch)}/><Metric label="Atenção" value={integer(w?.summary?.counts?.attention)}/><Metric label="Pós-clique" value={integer(w?.summary?.counts?.post_click)}/></div>
 <SectionHeader number="01" eyebrow="PRIORIDADE" title="Onde investigar primeiro" description="Itens com maior exposição potencial aparecem primeiro, mas sempre precisam ser validados com amostra e contexto."/>
 <div className="deep-two"><HorizontalBars title="Maiores exposições" rows={items.map((x,i)=>({key:x.creative_name||x.ad_name||x.type||`Item ${i+1}`,estimated_waste:n(x.estimated_waste)}))} valueKey="estimated_waste" formatValue={money}/><Surface eyebrow="GUIA DE LEITURA" title="O que cada tipo sugere"><div className="deep-checks"><p>✓ Atenção: revisar hook, thumb, headline, oferta inicial ou encaixe com o público.</p><p>✓ Pós-clique: revisar landing, velocidade, proposta, preço, checkout ou tracking.</p><p>✓ Público: comparar peça × audiência antes de reduzir verba.</p><p>✓ Placement: validar se o problema é contexto de entrega ou o criativo naquele contexto.</p></div></Surface></div>
 <SectionHeader number="02" eyebrow="DETALHE" title="Sinais classificados pelo motor" description="Cada linha mostra a hipótese de perda e o próximo passo recomendado para investigação."/>
 <Surface><DataTable rows={items.slice().sort((a,b)=>n(b.estimated_waste)-n(a.estimated_waste))} columns={[{key:'type',label:'Tipo'},{key:'creative_name',label:'Criativo'},{key:'ad_name',label:'Anúncio'},{key:'estimated_waste',label:'Exposição',render:r=>money(r.estimated_waste)},{key:'reason',label:'Diagnóstico'},{key:'action',label:'Próximo passo'}]}/></Surface></div>
}
