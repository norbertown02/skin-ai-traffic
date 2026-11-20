import React, { useMemo, useState } from 'react'
import { PageHeader, Surface, Badge } from '../components/UI.jsx'
import { money, integer, num, pct } from '../lib/format.js'
const n=v=>Number(v||0)
const initialProduct={sku:'',product_name:'',selling_price:'',product_cost:'',packaging_cost:'',shipping_subsidy:'',tax_pct:'',payment_pct:'',refund_pct:''}
const initialItem={kind:'experiment',title:'',hypothesis:'',entity_type:'',entity_id:'',primary_metric:'Compras e custo por compra',baseline_start:'',baseline_end:'',test_start:'',test_end:'',status:'planned',outcome:'',notes:''}
const statuses={planned:'Planejado',running:'Em teste',validating:'Validando',completed:'Concluído',cancelled:'Cancelado'}
const types={experiment:'Teste A/B ou hipótese',decision:'Decisão',task:'Tarefa de revisão'}
const fields=[['selling_price','Preço líquido ao cliente (R$)'],['product_cost','Custo do produto (R$)'],['packaging_cost','Embalagem (R$)'],['shipping_subsidy','Frete subsidiado (R$)'],['tax_pct','Impostos (%)'],['payment_pct','Pagamento e taxas (%)'],['refund_pct','Reserva para devoluções (%)']]
const inputText=(value,change,placeholder='')=><input value={value??''} onChange={e=>change(e.target.value)} placeholder={placeholder}/>
function math(p){
 const revenue=n(p.selling_price),fees=revenue*(n(p.tax_pct)+n(p.payment_pct)+n(p.refund_pct))/100
 const contribution=revenue-n(p.product_cost)-n(p.packaging_cost)-n(p.shipping_subsidy)-fees
 const ratio=revenue>0?contribution/revenue:null
 return {contribution,ratio,breakEven:contribution>0?revenue/contribution:null}
}
export function EconomicsStudio({data,workspace,onWorkspaceAction}){
 const products=workspace?.products??[]
 const [form,setForm]=useState(initialProduct),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('')
 const [search,setSearch]=useState('')
 const selected=math(form)
 const onSave=async e=>{
  e.preventDefault();setBusy(true);setError('');setSaved('')
  try{await onWorkspaceAction('save_product',{product:form});setForm(initialProduct);setSaved('Dados econômicos salvos no Supabase.')}catch(ex){setError(ex.message)}finally{setBusy(false)}
 }
 const onDelete=async sku=>{
  if(!window.confirm('Excluir o cadastro econômico de '+sku+'? Nenhum anúncio será afetado.'))return
  try{await onWorkspaceAction('delete_product',{sku});if(form.sku===sku)setForm(initialProduct)}catch(ex){setError(ex.message)}
 }
 const total=(data?.shopify?.business??[]).at(-1)
 const ratioStore=total?.has_shopify?total.mer:null
 const grouped=products.filter(p=>(p.sku+' '+p.product_name).toLowerCase().includes(search.toLowerCase()))
 return <div className="page pro-page ps-page">
 <PageHeader eyebrow="ECONOMIA E META" title="Rentabilidade por produto" description="Metas de mídia baseadas na margem de contribuição, não em ROAS isolado. Todos os valores abaixo precisam ser cadastrados e validados pela operação."/>
 <p className="ps-warning">Margem calculada antes da publicidade e de custos fixos. Não é lucro líquido nem contabilidade fiscal; preço deve ser líquido de descontos efetivos.</p>
 <div className="ps-kpis"><article className="ps-kpi"><span>MER da loja no filtro</span><strong>{ratioStore==null?'—':num(ratioStore)}</strong><small>Receita Shopify total ÷ investimento Meta</small></article><article className="ps-kpi"><span>Produtos com economia cadastrada</span><strong>{integer(products.length)}</strong><small>Os produtos sem custos não recebem avaliação de margem.</small></article><article className="ps-kpi"><span>Margem da simulação</span><strong>{n(form.selling_price)>0?pct(n(selected.ratio)*100):'—'}</strong><small>Contribuição antes de mídia</small></article><article className="ps-kpi"><span>ROAS teórico de equilíbrio</span><strong>{selected.breakEven==null?'—':num(selected.breakEven)+'x'}</strong><small>Exige receita atribuída compatível com a venda efetiva</small></article></div>
 <div className="ps-columns">
 <Surface eyebrow="CADASTRO" title="Economia unitária">
 <form className="ps-form" onSubmit={onSave}>
  <label>SKU {inputText(form.sku,v=>setForm(s=>({...s,sku:v})),'SKU usado no Shopify')}</label>
  <label>Nome do produto {inputText(form.product_name,v=>setForm(s=>({...s,product_name:v})),'Nome comercial')}</label>
  {fields.map(([key,title])=><label key={key}>{title}<input type="number" min="0" step="0.01" value={form[key]} onChange={e=>setForm(s=>({...s,[key]:e.target.value}))}/></label>)}
  <div className="ps-form-actions"><button className="btn primary" type="submit" disabled={busy||!form.sku.trim()||!form.product_name.trim()||!(n(form.selling_price)>0)}>{busy?'Salvando…':'Salvar produto'}</button><button className="btn" type="button" onClick={()=>setForm(initialProduct)}>Limpar</button></div>
  {error&&<p role="alert" className="ps-warning">{error}</p>}{saved&&<p role="status">{saved}</p>}
 </form>
 </Surface>
 <Surface eyebrow="SIMULADOR" title="Limite de investimento por venda">
  <p>Digite preço e custos para saber a contribuição disponível para mídia, sem assumir margem que não foi informada.</p>
  <div className="ps-simulator">
    <div><span>Preço considerado</span><strong>{money(form.selling_price)}</strong></div>
    <div><span>Contribuição antes da mídia</span><strong>{money(selected.contribution)}</strong></div>
    <div><span>Margem de contribuição</span><strong>{n(form.selling_price)>0?pct(100*n(selected.ratio)):'—'}</strong></div>
    <div><span>ROAS de equilíbrio</span><strong>{selected.breakEven==null?'Não sustentável':num(selected.breakEven)+'x'}</strong></div>
    <div><span>Gasto de mídia máximo para empatar na venda</span><strong>{selected.contribution>0?money(selected.contribution):'—'}</strong></div>
  </div>
  <p className="ps-help">É um limite de contribuição, não um CAC real de novos clientes. Não inclui despesas fixas, custo de capital e metas de lucro. LTV e recompra exigem dados de clientes.</p>
 </Surface>
 </div>
 <Surface eyebrow="CATÁLOGO" title="Produtos cadastrados">
  <label className="ps-search">Buscar SKU ou nome <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Produto"/></label>
  <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Preço</th><th>Contribuição</th><th>Margem</th><th>ROAS equilíbrio</th><th>Ações</th></tr></thead><tbody>
  {grouped.map(p=>{const m=math(p);return <tr key={p.id}><th>{p.product_name}<small className="ps-small">{p.sku}</small></th><td>{money(p.selling_price)}</td><td>{money(m.contribution)}</td><td>{m.ratio==null?'—':pct(100*m.ratio)}</td><td>{m.breakEven==null?'—':num(m.breakEven)+'x'}</td><td><button className="btn" onClick={()=>{setForm(Object.fromEntries([...Object.keys(initialProduct).map(k=>[k,p[k]??''])]));window.scrollTo({top:0,behavior:'smooth'})}}>Editar</button><button className="btn" onClick={()=>onDelete(p.sku)}>Excluir</button></td></tr>})}
  </tbody></table></div>{!grouped.length&&<p>Cadastre o primeiro produto para liberar os cálculos.</p>}
 </Surface></div>
}
export function ExperimentCenter({data,workspace,onWorkspaceAction,onNavigate}){
 const items=workspace?.items??[]
 const [form,setForm]=useState(initialItem),[filter,setFilter]=useState('all'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const metric=data?.bootstrap?.performance?.periods?.current??{}
 const quality=data?.manager?.quality??[]
 const unsafe=quality.some(x=>x.status!=='ok')
 const suggestions=[
  {title:'Validar UTMs da campanha principal',hypothesis:'Corrigir parâmetros inconsistentes pode melhorar a atribuição por origem.',kind:'task',primary_metric:'Cobertura de UTMs'},
  {title:'Testar variação de gancho em criativo',hypothesis:'Um gancho alternativo pode melhorar CTR sem piorar LPV.',kind:'experiment',primary_metric:'CTR link, LPV e compras'},
  {title:'Auditar a conversão do checkout',hypothesis:'Fricções de frete e pagamento podem limitar o número de pedidos.',kind:'task',primary_metric:'Checkout → pedido Shopify'}
 ]
 const save=async e=>{e.preventDefault();setBusy(true);setError('');setNotice('')
  try{await onWorkspaceAction('save_item',{item:form});setForm(initialItem);setNotice('Registro salvo para acompanhamento e validação.')}catch(ex){setError(ex.message)}finally{setBusy(false)}
 }
 const del=async id=>{if(!window.confirm('Excluir este registro?'))return;try{await onWorkspaceAction('delete_item',{id})}catch(ex){setError(ex.message)}}
 const progress=items.filter(x=>['running','validating'].includes(x.status)).length
 const completed=items.filter(x=>x.status==='completed').length
 return <div className="page pro-page ps-page">
 <PageHeader eyebrow="LABORATÓRIO" title="Testes, decisões e aprendizado" description="Registre hipóteses, indicadores, períodos, resultados e conclusão. O aplicativo não modifica campanhas automaticamente."/>
 <div className="ps-kpis"><article className="ps-kpi"><span>Registros</span><strong>{integer(items.length)}</strong><small>Histórico do espaço de trabalho</small></article><article className="ps-kpi"><span>Em teste ou validação</span><strong>{integer(progress)}</strong><small>Monitorar resultados</small></article><article className="ps-kpi"><span>Concluídos</span><strong>{integer(completed)}</strong><small>Aprendizado registrado</small></article><article className="ps-kpi"><span>Compras Meta no filtro</span><strong>{integer(metric.purchases)}</strong><small>{unsafe?'Dados com ressalvas de qualidade':'Validar amostra antes de decidir'}</small></article></div>
 <div className="ps-columns">
 <Surface eyebrow="NOVO REGISTRO" title={form.id?'Editar experimento ou decisão':'Criar experimento ou decisão'}>
 <form className="ps-form" onSubmit={save}>
  <label>Tipo<select value={form.kind} onChange={e=>setForm(s=>({...s,kind:e.target.value}))}>{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Título<input value={form.title} maxLength="240" onChange={e=>setForm(s=>({...s,title:e.target.value}))} placeholder="O que vamos investigar?" required/></label>
  <label>Hipótese<textarea value={form.hypothesis} onChange={e=>setForm(s=>({...s,hypothesis:e.target.value}))} rows="3" placeholder="Por que essa mudança poderia funcionar?"/></label>
  <label>Indicador principal<input value={form.primary_metric} onChange={e=>setForm(s=>({...s,primary_metric:e.target.value}))}/></label>
  <div className="ps-form-grid"><label>Base — início<input type="date" value={form.baseline_start??''} onChange={e=>setForm(s=>({...s,baseline_start:e.target.value}))}/></label><label>Base — fim<input type="date" value={form.baseline_end??''} onChange={e=>setForm(s=>({...s,baseline_end:e.target.value}))}/></label><label>Teste — início<input type="date" value={form.test_start??''} onChange={e=>setForm(s=>({...s,test_start:e.target.value}))}/></label><label>Teste — fim<input type="date" value={form.test_end??''} onChange={e=>setForm(s=>({...s,test_end:e.target.value}))}/></label></div>
  <label>Situação<select value={form.status} onChange={e=>setForm(s=>({...s,status:e.target.value}))}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Resultado e conclusão<textarea rows="3" value={form.outcome} onChange={e=>setForm(s=>({...s,outcome:e.target.value}))} placeholder="O que foi comprovado, refutado ou permanece inconclusivo?"/></label>
  <label>Observações<textarea rows="2" value={form.notes} onChange={e=>setForm(s=>({...s,notes:e.target.value}))}/></label>
  <div className="ps-form-actions"><button type="submit" className="btn primary" disabled={busy||form.title.trim().length<3}>{busy?'Salvando…':form.id?'Atualizar registro':'Registrar'}</button><button type="button" className="btn" onClick={()=>setForm(initialItem)}>Limpar</button></div>
  {error&&<p role="alert" className="ps-warning">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </form></Surface>
 <Surface eyebrow="IDEIAS PARA TESTES" title="Hipóteses investigáveis">
  <p>Os cartões são sugestões gerais, não confirmações de causalidade. Registre uma hipótese por vez e um indicador principal.</p>
  <div className="ps-actions">{suggestions.map(s=><button key={s.title} onClick={()=>{setForm({...initialItem,...s});window.scrollTo({top:0,behavior:'smooth'})}}><strong>{s.title}</strong><span>{s.hypothesis}</span></button>)}</div>
  <p className="ps-help">Mudanças reais no Meta Ads exigem aprovação e execução manual; este módulo apenas registra o planejamento.</p>
 </Surface></div>
 <Surface eyebrow="HISTÓRICO" title="Linha do tempo de decisões">
  <div className="ps-toolbar"><label>Status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="btn" onClick={()=>onNavigate('analysis')}>Abrir análise detalhada</button></div>
  <div className="ps-history">{items.filter(x=>filter==='all'||x.status===filter).map(x=><article key={x.id}><header><Badge tone={x.status==='completed'?'success':x.status==='cancelled'?'neutral':'warning'}>{statuses[x.status]}</Badge><span>{types[x.kind]} · {new Date(x.created_at).toLocaleDateString('pt-BR')}</span></header><h3>{x.title}</h3><p>{x.hypothesis}</p><small>Indicador: {x.primary_metric||'a definir'} · {x.test_start||'sem data'} a {x.test_end||'sem data'}</small>{x.outcome&&<p><strong>Conclusão: </strong>{x.outcome}</p>}<div className="ps-form-actions"><button className="btn" onClick={()=>{setForm({...x});window.scrollTo({top:0,behavior:'smooth'})}}>Editar</button><button className="btn" onClick={()=>del(x.id)}>Excluir</button></div></article>)}</div>
  {!items.length&&<p>Nenhuma decisão registrada. Comece com uma hipótese e uma métrica.</p>}
 </Surface></div>
}