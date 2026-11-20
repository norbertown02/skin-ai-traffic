import React, {useState} from 'react'
import { PageHeader, Surface, Badge } from '../components/UI.jsx'
import { money, integer, pct } from '../lib/format.js'
const n=v=>Number(v||0)
const valid=v=>v!=null
const normalize=v=>String(v||'').trim().toLocaleLowerCase('pt-BR')
const fmtDate=value=>value?value.split('-').reverse().join('/'):'—'
export default function CommerceIntelligence({data,workspace,onNavigate}){
 const main=data?.shopify?.business??[]
 const allowed=new Set(main.filter(x=>x.has_shopify).map(x=>x.month_start))
 const rows=(workspace?.customerMix??[]).filter(x=>allowed.has(x.month_start))
 const sold=(workspace?.productMix??[]).filter(x=>allowed.has(x.month_start))
 const [month,setMonth]=useState('')
 const [sort,setSort]=useState('total_sales')
 const [search,setSearch]=useState('')
 const latest=main.at(-1)?.month_start
 const selected=allowed.has(month)?month:allowed.has(latest)?latest:[...allowed].at(-1)
 const segment=rows.filter(x=>x.month_start===selected)
 const current=main.find(x=>x.month_start===selected)
 const products=sold.filter(x=>x.month_start===selected && normalize(x.product_name).includes(normalize(search))).slice().sort((a,b)=>n(b[sort])-n(a[sort]))
 const newBuyer=segment.find(x=>x.segment==='New'),oldBuyer=segment.find(x=>x.segment==='Returning')
 const segmentCount=segment.reduce((s,x)=>s+n(x.orders),0)
 const totalReported=n(current?.shopify_orders)
 const latestImport=segment.map(x=>x.synced_at).sort().at(-1)
 const sourceMismatch=Boolean(segmentCount&&totalReported&&segmentCount!==totalReported)
 const profiles=workspace?.products??[]
 return <div className="page pro-page ps-page">
 <PageHeader eyebrow="COMÉRCIO" title="Produtos e recorrência" description="Vendas por produto e pedidos classificados pela Shopify como novos ou recorrentes. Dados comerciais mensais, sem identificação pessoal."/>
 <p className="ps-help">Última importação desta análise: {latestImport?new Date(latestImport).toLocaleString('pt-BR'):'indisponível'} · os agregados ainda não possuem atualização automática.</p>
 <div className="ps-toolbar"><label>Mês disponível <select value={selected??''} onChange={e=>setMonth(e.target.value)}>{[...allowed].reverse().map(m=><option key={m} value={m}>{m.slice(5,7)+'/'+m.slice(0,4)}</option>)}</select></label>
 <small>Somente intervalos com cobertura comercial compatível com o filtro global.</small></div>
 {!current?.has_shopify&&<p className="ps-warning" role="status">Não há dados Shopify comparáveis para esse intervalo. Selecione um mês completo ou uma janela mensal com mesmas datas.</p>}
 <div className="ps-kpis">
  <article className="ps-kpi"><span>Pedidos Shopify no mês</span><strong>{current?.has_shopify?integer(current.shopify_orders):'—'}</strong><small>Total da loja; fonte mensal</small></article>
  <article className="ps-kpi"><span>Pedidos classificados como novos</span><strong>{valid(newBuyer?.orders)?integer(newBuyer.orders):'—'}</strong><small>Classificação Shopify, não identificador pessoal</small></article>
  <article className="ps-kpi"><span>Pedidos classificados como recorrentes</span><strong>{valid(oldBuyer?.orders)?integer(oldBuyer.orders):'—'}</strong><small>Classificação Shopify no período</small></article>
  <article className="ps-kpi"><span>Participação de novos</span><strong>{segmentCount?pct(100*n(newBuyer?.orders)/segmentCount):'—'}</strong><small>Sobre os pedidos com segmentação retornada</small></article>
 </div>
 {sourceMismatch&&<p className="ps-warning">A soma dos pedidos segmentados ({integer(segmentCount)}) difere do total mensal da Shopify ({integer(totalReported)}). Compare a data de importação e a definição de cada métrica antes de usar a divisão para decisões.</p>}
 <div className="ps-columns">
 <Surface eyebrow="NOVOS X RECORRENTES" title="Origem do relacionamento">
  <div className="ps-simulator"><div><span>Receita de pedidos novos</span><strong>{valid(newBuyer?.total_sales)?money(newBuyer.total_sales):'—'}</strong></div><div><span>Receita de pedidos recorrentes</span><strong>{valid(oldBuyer?.total_sales)?money(oldBuyer.total_sales):'—'}</strong></div><div><span>Pedidos classificados</span><strong>{integer(segmentCount)}</strong></div></div>
  <p className="ps-help">Esses pedidos não provam que foram adquiridos pelo Meta. Não equivalem a CAC de novos clientes nem a LTV.</p>
 </Surface>
 <Surface eyebrow="CONTEXTO" title="O que devemos decidir">
  <div className="ps-actions"><div><strong>Aquisição</strong><span>Compare receita de clientes novos com gasto de mídia, sem atribuir automaticamente todos os novos pedidos ao Meta.</span></div><div><strong>Recompra</strong><span>Observe a participação de recorrentes ao longo dos meses. Um teste de fidelização exige histórico individual autorizado.</span></div><button onClick={()=>onNavigate('economics')}><strong>Rentabilidade por SKU</strong><span>Cadastre custos para separar produto com boa venda de produto com boa margem.</span></button></div>
 </Surface>
 </div>
 <Surface eyebrow="PRODUTOS" title="Itens vendidos no intervalo">
 <p>Pedidos por item podem se repetir entre produtos de um mesmo pedido; não some esta coluna para calcular pedidos totais. Linhas sem nome ficam identificadas como não atribuídas.</p>
 <div className="ps-toolbar"><label>Pesquisar produto<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex. sérum"/></label><label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="total_sales">Receita atribuída ao item</option><option value="net_items_sold">Unidades líquidas</option><option value="orders">Pedidos que incluem o item</option></select></label></div>
 <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Receita por item</th><th>Unidades líquidas</th><th>Pedidos que incluem o item</th><th>Economia cadastrada</th></tr></thead><tbody>
 {products.map((x,i)=><tr key={x.month_start+x.product_name+i}><th>{x.product_name}</th><td>{money(x.total_sales)}</td><td>{integer(x.net_items_sold)}</td><td>{integer(x.orders)}</td><td><Badge tone={profiles.some(y=>normalize(y.product_name)===normalize(x.product_name))?'success':'warning'}>{profiles.some(y=>normalize(y.product_name)===normalize(x.product_name))?'Cadastrada':'Falta custo'}</Badge></td></tr>)}
 </tbody></table></div>
 {!products.length&&<p>Sem produtos neste filtro. Altere o mês ou o termo de busca.</p>}
 <p className="ps-help">Estatísticas históricas do ShopifyQL importadas até {fmtDate(current?.shopify_through_date)}; devoluções, descontos e frete podem afetar a receita agregada. Conciliação por pedido e variação específica seguem pendentes.</p>
 </Surface></div>
}
