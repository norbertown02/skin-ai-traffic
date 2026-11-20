import React, { useState } from 'react'
import { PageHeader, Surface, Badge } from '../components/UI.jsx'
import { integer, money, monthLabel, sourceDate } from '../lib/format.js'

const day = value => value?.split('-').reverse().join('/') ?? '—'
const instant = value => value ? new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : '—'
const statusLabels = {
  complete:'Completa', nonstandard:'Fora do padrão', dynamic:'Parâmetros dinâmicos a validar', incomplete:'Incompleta',
  conflict:'Valores divergentes', unavailable:'Configuração indisponível',
}
const amount = (value, format) => value == null ? '—' : format(value)

export default function IntegrationsClean({ data, workspace }) {
  const [utmStatus, setUtmStatus] = useState('')
  const business = data?.shopify?.business ?? []
  const quality = data?.manager?.quality ?? []
  const utm = data?.utm
  const sources = data?.sources
  const utmAds = (utm?.ads ?? []).filter(row => !utmStatus || row.status === utmStatus)
  const latestShopify = business.filter(row => row.has_shopify).at(-1)
  const importedProducts=workspace?.productMix??[]
  const importedSegments=workspace?.customerMix??[]
  const importedAt=importedProducts.map(row=>row.synced_at).filter(Boolean).sort().at(-1)
  const shopifySync=workspace?.shopifySync
  const detailed=workspace?.orderDetail??[]
  const ordersSeen=detailed.reduce((sum,row)=>sum+Number(row.orders_seen||0),0)
  const latestOrderImport=detailed.map(row=>row.imported_at).filter(Boolean).sort().at(-1)
  return <div className="page pro-page integrations-page">
    <PageHeader eyebrow="INTEGRAÇÕES" title="Saúde das fontes de dados" description="Cobertura, atualização e diagnóstico do histórico armazenado." />
    <div className="pro-integration-grid">
      <Surface eyebrow="SHOPIFY" title="Resultado comercial">
        <p>Dados até {day(sources?.shopify?.through ?? latestShopify?.shopify_through_date)} · última importação {instant(sources?.shopify?.syncedAt ?? latestShopify?.shopify_synced_at)}.</p>
        <p>Consolidação mensal de pedidos, vendas e sessões. Conexão ao vivo não verificada.</p>
      </Surface>
      <Surface eyebrow="META ADS" title="Entrega e atribuição">
        <p>Dados até {day(sources?.meta?.through ?? sourceDate(data))} · última sincronização concluída {instant(sources?.meta?.syncedAt)}.</p>
        <p>Histórico de entrega e conversões atribuídas. Conexão ao vivo não verificada.</p>
      </Surface>
    </div>
    <Surface eyebrow="CAMADAS COMERCIAIS" title="Cobertura dos agregados Shopify">
      <p>Produtos vendidos: {integer(importedProducts.length)} registros mensais · novos e recorrentes: {integer(importedSegments.length)} registros mensais.</p>
      <p>Última importação desses recortes: {instant(importedAt)}. Essa data é independente da sincronização de Meta Ads.</p>
      <p>Pedidos individuais importados: {integer(ordersSeen)} · última importação {instant(latestOrderImport)}. As informações pessoais não são enviadas para o navegador; somente dados agregados são apresentados.</p>
      <p>Itens de pedidos por SKU: {integer((workspace?.skuDetail??[]).length)} agrupamentos mensais. O sistema distingue pedidos detalhados do relatório mensal ShopifyQL, pois as receitas podem ter critérios diferentes.</p>
      <div className="ps-checks"><div><Badge tone={shopifySync?.enabled?'success':'warning'}>{shopifySync?.enabled?'Ativada':'Aguardando credenciais'}</Badge><strong>Atualização automática de pedidos</strong><p>Agendamento previsto: a cada 30 minutos, nos minutos 15 e 45. A rotina permanece desativada até a instalação/autorização do aplicativo Shopify.</p></div></div>
      <p>Última sincronização automática concluída: {instant(shopifySync?.last_success_at)}. Última tentativa: {instant(shopifySync?.last_started_at)}. {shopifySync?.last_error_code?'Diagnóstico: '+shopifySync.last_error_code:''}</p>
      {!shopifySync?.enabled&&<div className="ps-warning">
        <strong>Etapa necessária para ativar</strong>
        <p>Crie/instale um aplicativo Shopify autorizado para esta loja no <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noreferrer">Dev Dashboard</a>, com permissão de leitura de pedidos. Para todo o histórico além de 60 dias, é necessária a permissão adicional de pedidos antigos, conforme disponibilidade da Shopify.</p>
        <p>Configure SHOPIFY_CLIENT_ID e SHOPIFY_CLIENT_SECRET como secrets no projeto Supabase <a href="https://supabase.com/dashboard/project/knosvoutxkfkawwygmyt/settings/functions" target="_blank" rel="noreferrer">Skin Beauty</a>. Não compartilhe essas credenciais pelo chat ou no GitHub. Após essa configuração, ativaremos a rotina automática com um teste da conexão.</p>
      </div>}
      <p className="ps-help">A atualização automática preparada é a de pedidos e itens. Sessões, métricas mensais e os recortes agregados ShopifyQL ainda exigem uma rotina separada; seus horários de importação são apresentados independentemente.</p>
    </Surface>
    {sources && <Surface eyebrow="VALIDAÇÃO" title="Meta Ads e Shopify">
      <p>O Meta atribui conversões à mídia. A Shopify contabiliza pedidos e vendas totais da loja. A diferença é diagnóstica e só aparece quando as datas coincidem.</p>
      <div className="table-wrap"><table><thead><tr><th>Período de mídia</th><th>Shopify até</th><th>Compras Meta</th><th>Pedidos Shopify</th><th>Receita Meta</th><th>Vendas Shopify</th><th>Diferença de compras</th><th>Diferença de receita</th><th>Cobertura</th></tr></thead>
        <tbody>{business.map(row=><tr key={row.month_start}>
          <th scope="row">{monthLabel(row.month_start)} · {day(row.start)} a {day(row.meta_through_date)}</th><td>{day(row.shopify_through_date)}</td>
          <td>{amount(row.meta_purchases,integer)}</td><td>{amount(row.shopify_orders,integer)}</td>
          <td>{amount(row.meta_revenue,money)}</td><td>{amount(row.shopify_revenue,money)}</td>
          <td>{amount(row.purchase_gap,integer)}</td><td>{amount(row.revenue_gap,money)}</td>
          <td>{row.comparison_status==='aligned'?'Datas alinhadas':row.comparison_status==='different_window'?'Cobertura incompatível':'Sem histórico mensal'}</td>
        </tr>)}</tbody></table></div>
      <p>Diferença calculada como Meta menos Shopify no mesmo intervalo reportado, em BRL. Horários de corte e janela de atribuição podem afetar a leitura.</p>
    </Surface>}
    <Surface eyebrow="QUALIDADE" title="Validações do período">
      <ul>{quality.map((item,index)=><li key={item.name ?? index}>
        <strong>{item.name}</strong>{' '}<Badge tone={item.status==='ok'?'success':'warning'}>{item.status==='ok'?'OK':'Atenção'}</Badge>
        <p>{item.message}</p>
      </li>)}</ul>
    </Surface>
    {utm && <Surface eyebrow="RASTREAMENTO" title="Diagnóstico de UTMs">
      <p>Padrão esperado: utm_source, utm_medium e utm_campaign. Use valores consistentes em minúsculas, como facebook e paid_social. A análise usa a configuração disponível dos criativos com entrega no filtro.</p>
      <label>Status da UTM <select value={utmStatus} onChange={event=>setUtmStatus(event.target.value)}>
        <option value="">Todos ({utm.ads.length})</option>
        {Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label} ({utm.counts[key] ?? 0})</option>)}
      </select></label>
      {utmAds.length ? <div className="table-wrap"><table><thead><tr><th>Anúncio</th><th>Gasto</th><th>Status</th><th>Parâmetros faltantes</th></tr></thead>
        <tbody>{utmAds.map(row=><tr key={row.id}><th scope="row">{row.name ?? row.id}</th><td>{amount(row.spend,money)}</td>
          <td>{statusLabels[row.status]}</td><td>{row.missing.join(', ') || '—'}</td></tr>)}</tbody></table></div>
        : <p role="status">Nenhum anúncio com esse status no período.</p>}
    </Surface>}
  </div>
}
