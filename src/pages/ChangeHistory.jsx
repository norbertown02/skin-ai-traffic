import React, { useState } from 'react'
import { PageHeader, Surface } from '../components/UI.jsx'
import { integer } from '../lib/format.js'
const names={ad:'Anúncio',ad_set:'Conjunto',campaign:'Campanha',creative:'Criativo'}
const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—'
export default function ChangeHistory({workspace,onNavigate,data}) {
 const entries=workspace?.events??[]
 const period=data?.bootstrap?.main?.period
 const [type,setType]=useState('all')
 const [text,setText]=useState('')
 const [periodOnly,setPeriodOnly]=useState(false)
 const visible=entries.filter(x=>(type==='all'||x.entity_type===type)
  && (!text||[x.entity_name,x.entity_id,x.change_types].join(' ').toLowerCase().includes(text.toLowerCase()))
  && (!periodOnly||x.captured_on>=period?.start && x.captured_on<=period?.end))
 const exportCsv=()=>{
   const columns=['captured_on','entity_type','entity_id','entity_name','change_types']
   const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"'
   const csv=[columns.join(';'),...visible.map(x=>columns.map(k=>quote(x[k])).join(';'))].join('\r\n')
   const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
   const link=document.createElement('a');link.href=url;link.download='skin-alteracoes-meta.csv';link.click()
   setTimeout(()=>URL.revokeObjectURL(url),500)
 }
 return <div className="page pro-page ps-page">
 <PageHeader eyebrow="HISTÓRICO" title="Alterações observadas no Meta" description="Mudanças identificadas comparando as capturas periódicas de configuração. Não são alterações executadas pelo AI Traffic."/>
 <p className="ps-warning">A data abaixo é a data da captura na qual a mudança foi observada, não necessariamente a data e hora efetiva da edição no Meta Ads. Uma mudança pode não ser detectada se for revertida entre duas capturas.</p>
 <div className="ps-kpis"><article className="ps-kpi"><span>Eventos disponíveis</span><strong>{integer(entries.length)}</strong><small>Até 100 registros mais recentes</small></article><article className="ps-kpi"><span>Alterações em campanhas</span><strong>{integer(visible.filter(x=>x.entity_type==='campaign').length)}</strong><small>Registros no filtro</small></article><article className="ps-kpi"><span>Alterações em anúncios</span><strong>{integer(visible.filter(x=>x.entity_type==='ad').length)}</strong><small>Registros no filtro</small></article></div>
 <Surface eyebrow="AUDITORIA" title="Linha do tempo da conta">
 <div className="ps-toolbar"><label>Tipo<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todas as estruturas</option>{Object.entries(names).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label>Buscar<input value={text} onChange={e=>setText(e.target.value)} placeholder="Nome, código ou mudança"/></label>
 <label className="ps-inline-check"><input type="checkbox" checked={periodOnly} onChange={e=>setPeriodOnly(e.target.checked)}/>Somente período selecionado</label>
 <button className="btn" disabled={!visible.length} onClick={exportCsv}>Exportar CSV</button></div>
 <div className="table-wrap"><table><thead><tr><th>Observado em</th><th>Nível</th><th>Entidade</th><th>O que mudou</th></tr></thead><tbody>
 {visible.map((x,i)=><tr key={x.entity_id+'-'+x.captured_on+'-'+i}><td>{date(x.captured_on)}</td><td>{names[x.entity_type]||x.entity_type}</td><th>{x.entity_name}<small className="ps-small">{x.entity_id}</small></th><td>{x.change_types}</td></tr>)}
 </tbody></table></div>
 {!visible.length&&<p>Sem eventos nesse filtro. Remova os filtros ou consulte outro período.</p>}
 <p className="ps-help">Para saber se uma alteração teve efeito, registre um teste com hipótese e critérios claros e analise janelas comparáveis. Correlação não prova causalidade.</p>
 <button className="btn primary" onClick={()=>onNavigate('experiments')}>Registrar teste relacionado</button>
 </Surface></div>
}