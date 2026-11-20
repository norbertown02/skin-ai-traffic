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
 const sync=workspace?.shopifySync
 const orderDetail=(workspace?.orderDetail??[]).find(x=>x.month_start===selected)
 const skuDetail=(workspace?.skuDetail??[]).filter(x=>x.month_start===selected)
 const utms=(workspace?.orderUtm??[]).filter(x=>x.day?.slice(0,7)===selected?.slice(0,7))
 const attributed=utms.reduce((a,x)=>a+n(x.tagged_orders),0)
 const utmTotal=utms.reduce((a,x)=>a+n(x.orders),0)
 const sourceMap=new Map()
 for(const x of utms){
   const key=(x.utm_source||'(sem utm)')+' · '+(x.utm_medium||'(sem utm)')
   const old=sourceMap.get(key)||{source:key,orders:0,revenue:0,first:0,repeat:0}
   old.orders+=n(x.orders);old.revenue+=n(x.revenue);old.first+=n(x.first_orders);old.repeat+=n(x.repeat_orders)
   sourceMap.set(key,old)
 }
 const attributionRows=[...sourceMap.values()].sort((a,b)=>b.orders-a.orders)
 const cohorts=(workspace?.cohorts??[]).slice().reverse()
 const localTime=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—'
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
 </Surface>
 <Surface eyebrow="PEDIDOS INDIVIDUAIS" title="Leitura detalhada, sem dados pessoais">
  <p>Agora existe uma base de pedidos reais e seus itens, vinculados por identificadores internos e com clientes pseudonimizados. Os totais aqui usam o valor atual do pedido e NÃO substituem as vendas contabilizadas pela ShopifyQL.</p>
  <div className="ps-kpis">
   <article className="ps-kpi"><span>Pedidos encontrados no mês</span><strong>{orderDetail?integer(orderDetail.orders_seen):'—'}</strong><small>Inclui cancelados; somente pedidos importados</small></article>
   <article className="ps-kpi"><span>Pedidos não cancelados</span><strong>{orderDetail?integer(orderDetail.valid_orders):'—'}</strong><small>{orderDetail?integer(orderDetail.cancelled_orders)+' cancelados':'Aguardando importação'}</small></article>
   <article className="ps-kpi"><span>Valor atual dos pedidos</span><strong>{orderDetail?money(orderDetail.current_order_total):'—'}</strong><small>Não equivalente à receita líquida da ShopifyQL</small></article>
   <article className="ps-kpi"><span>Pedidos com UTMs identificadas</span><strong>{utmTotal?pct(100*attributed/utmTotal):'—'}</strong><small>Cobertura de origem, não de causalidade</small></article>
  </div>
  {orderDetail?.incomplete_line_items>0&&<p className="ps-warning">{integer(orderDetail.incomplete_line_items)} pedido(s) com itens incompletos. Produtos desses pedidos não entram no ranking por SKU.</p>}
  <p className="ps-help">Importação mais recente: {localTime(orderDetail?.imported_at)}. Rotina automática: {sync?.enabled?'habilitada':'aguardando conexão autorizada'}. Última execução concluída: {localTime(sync?.last_success_at)}.</p>
 </Surface>
 <div className="ps-columns">
 <Surface eyebrow="ORIGEM DOS PEDIDOS" title="UTMs efetivamente observadas">
  <p>Fonte e mídia extraídas da jornada registrada pela Shopify. Pedidos sem UTM aparecem separados; origens como Meta, Google e e-mail não provam atribuição incremental.</p>
  <div className="table-wrap"><table><thead><tr><th>Origem / mídia</th><th>Pedidos</th><th>Valor atual</th><th>1ª compra</th><th>Recorrentes</th></tr></thead><tbody>
   {attributionRows.slice(0,20).map(row=><tr key={row.source}><th>{row.source}</th><td>{integer(row.orders)}</td><td>{money(row.revenue)}</td><td>{integer(row.first)}</td><td>{integer(row.repeat)}</td></tr>)}
  </tbody></table></div>
  {!attributionRows.length&&<p>Sem dados de origem neste período.</p>}
 </Surface>
 <Surface eyebrow="COORTES OBSERVADAS" title="Recompra e receita por cliente identificado">
  <p>As coortes mostram apenas pedidos presentes na base importada. A receita por cliente é observada, <strong>não é LTV definitivo</strong>, e não inclui pedidos anteriores ao período coberto.</p>
  <div className="table-wrap"><table><thead><tr><th>Primeira compra observada</th><th>Clientes</th><th>Com recompra observada</th><th>Receita/cliente</th></tr></thead><tbody>
    {cohorts.map(row=><tr key={row.cohort}><th>{row.cohort.slice(5,7)}/{row.cohort.slice(0,4)}</th><td>{integer(row.customers_seen)}</td><td>{integer(row.observed_repeat_customers)}</td><td>{money(row.revenue_per_observed_customer)}</td></tr>)}
  </tbody></table></div>
  {!cohorts.length&&<p>Histórico individual ainda não disponível.</p>}
 </Surface>
 </div>
 <Surface eyebrow="POR SKU" title="Itens ligados aos pedidos reais">
  <p>Esta tabela é baseada em itens de pedido com SKU, não em agregados por nome de produto. Um mesmo pedido pode aparecer em vários produtos; custos cadastrados precisam usar o SKU correspondente.</p>
  <div className="table-wrap"><table><thead><tr><th>SKU / produto</th><th>Pedidos que contêm</th><th>Unidades</th><th>Valor dos itens</th><th>Custo cadastrado</th></tr></thead><tbody>
   {skuDetail.slice().sort((a,b)=>n(b.item_sales)-n(a.item_sales)).slice(0,50).map(row=><tr key={row.sku}><th>{row.sku}<small className="ps-small">{row.product_name}</small></th><td>{integer(row.orders_including_item)}</td><td>{integer(row.units)}</td><td>{money(row.item_sales)}</td><td><Badge tone={profiles.some(p=>p.sku===row.sku)?'success':'warning'}>{profiles.some(p=>p.sku===row.sku)?'Cadastrado':'Pendente'}</Badge></td></tr>)}
  </tbody></table></div>
  {!skuDetail.length&&<p>Sem itens detalhados para este período.</p>}
 </Surface>
 </div>
}
