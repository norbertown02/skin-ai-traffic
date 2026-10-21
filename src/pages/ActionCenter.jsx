
import React, { useMemo, useState } from 'react'
import { cleanCreativeName, integer, money, monthLabel, num, pct, sourceDate } from '../lib/format.js'
import { classifyFunnelContext, stageLabel } from '../lib/funnelContext.js'

const list = value => Array.isArray(value) ? value : []
const value = input => { const n = Number(input); return Number.isFinite(n) ? n : 0 }
const count = row => value(row?.purchases ?? row?.pur ?? row?.metrics?.purchases)
const spendOf = row => value(row?.spend ?? row?.metrics?.spend)
const cpa = row => count(row) > 0 ? spendOf(row) / count(row) : null
const rowName = (row, fallback) => String(row?.name || row?.ad_set_name || row?.campaign_name || fallback)
const PRIORITY = { high: 3, medium: 2, info: 1 }
const LABELS = { creatives: 'Criativos', audiences: 'Públicos', campaigns: 'Campanhas' }
const LINKS = { creatives: 'creatives', audiences: 'audiences', campaigns: 'campaigns' }
const STORAGE = 'skin_action_center_reviewed_v1'

function readStrategy() {
  try { return JSON.parse(localStorage.getItem('skin_growth_strategy_v1') || '{}') || {} } catch { return {} }
}
function readReviewed() {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '{}') || {} } catch { return {} }
}
function action(group, kind, id, level, title, evidence, next, validation, confidence = 'Leitura por indicadores') {
  return { group, kind, id: group + ':' + kind + ':' + String(id), level, title, evidence, next, validation, confidence }
}
function byPriority(a,b) { return PRIORITY[b.level] - PRIORITY[a.level] }
function usefulCPA(rows) {
  const qualified = rows.filter(r => count(r) >= 3 && spendOf(r) > 0)
  const purchases = qualified.reduce((s,r) => s + count(r), 0)
  return purchases >= 6 ? qualified.reduce((s,r) => s + spendOf(r), 0) / purchases : 0
}

export function deriveRecommendations(data, goals = {}) {
  const deep = data?.deep || {}
  const main = data?.bootstrap?.main || {}
  const current = main?.cur || {}
  const creatives = list(deep.creative_profiles)
  const sets = list(current.sets).length ? list(current.sets) : list(main.audienceRows)
  const campaigns = list(current.campaigns)
  const monthly = list(data?.shopify?.business)
  const shop = monthly.at(-1) || {}
  const maxCAC = value(goals.max_cac)
  const minMER = value(goals.min_mer)
  const output = { creatives: [], audiences: [], campaigns: [] }
  const add = item => output[item.group].push(item)

  // Guardrail-driven alerts: never present a raw ROAS or an arbitrary CPA as a profit threshold.
  const ctrReference = value(deep?.benchmarks?.avg_ctr)
  const eligibleCreatives = creatives.filter(p => spendOf(p) > 0)
  const creativeCPA = usefulCPA(eligibleCreatives.map(p => ({ spend: spendOf(p), purchases: count(p) })))
  const referenceCAC = maxCAC || creativeCPA
  const referLabel = maxCAC ? 'CAC máximo configurado' : 'CAC observado em peças com pelo menos 3 compras'
  const weakCreative = eligibleCreatives.filter(p => {
    const m = p.metrics || {}
    return ctrReference > 0 && value(m.impressions) >= 1000 && value(m.ctr) > 0 && value(m.ctr) < ctrReference * 0.75
  }).sort((a,b) => spendOf(b) - spendOf(a))[0]
  if (weakCreative) {
    add(action('creatives', 'hook', weakCreative.id || weakCreative.name, 'high',
      'Renovar a abertura de ' + cleanCreativeName(weakCreative.name, 'criativo'),
      'CTR ' + pct(weakCreative.metrics?.ctr) + ' contra média da conta de ' + pct(ctrReference) + '; ' + money(spendOf(weakCreative)) + ' investidos.',
      'Produzir duas variações de gancho e primeira cena, mantendo a peça original como controle no mesmo público.',
      'Comparar CTR, CPC e chegada à página após volume semelhante de impressões.',
      'Sinal comparativo; não prova sozinho fadiga criativa.'))
  }
  const zeroCreative = referenceCAC > 0 ? eligibleCreatives.filter(p => count(p) === 0 && spendOf(p) >= 1.5 * referenceCAC)
    .sort((a,b) => spendOf(b) - spendOf(a))[0] : null
  if (zeroCreative && (!weakCreative || zeroCreative.id !== weakCreative.id)) {
    add(action('creatives', 'zero', zeroCreative.id || zeroCreative.name, 'high',
      'Revisar a peça ' + cleanCreativeName(zeroCreative.name, 'criativo'),
      money(spendOf(zeroCreative)) + ' gastos sem compra atribuída; referência: ' + money(referenceCAC) + ' (' + referLabel + ').',
      'Conferir estágio de funil, públicos e qualidade da página antes de decidir pela pausa. Testar uma nova proposta visual.',
      'Verificar compras atribuídas e vendas Shopify; não pausar apenas por uma janela curta.',
      maxCAC ? 'Comparação com meta definida' : 'Comparação interna exploratória'))
  }
  const winners = eligibleCreatives.filter(p => count(p) >= 3 && (maxCAC ? cpa({spend:spendOf(p),purchases:count(p)}) <= maxCAC : true))
    .sort((a,b) => count(b) - count(a))
  const winner = winners[0]
  if (winner) add(action('creatives', 'control', winner.id || winner.name, 'medium',
    'Preservar ' + cleanCreativeName(winner.name, 'criativo') + ' como controle',
    integer(count(winner)) + ' compras atribuídas · custo por compra ' + money(spendOf(winner) / count(winner)) + '.',
    'Manter esta peça no teste e criar uma variante de conceito sem substituir a original de imediato.',
    'A variante deve sustentar compras e custo por compra, não apenas CTR.',
    maxCAC ? 'Custo comparado ao CAC máximo definido' : 'Boa amostra de compras; lucratividade não validada'))

  const eligibleSets = sets.filter(r => spendOf(r) > 0)
  const setCPA = usefulCPA(eligibleSets)
  const setReference = maxCAC || setCPA
  const noPurchaseSet = setReference > 0 ? eligibleSets.filter(r => count(r) === 0 && spendOf(r) >= 1.5 * setReference)
    .sort((a,b) => spendOf(b) - spendOf(a))[0] : null
  if (noPurchaseSet) {
    const context = classifyFunnelContext(noPurchaseSet)
    add(action('audiences', 'review', noPurchaseSet.id || rowName(noPurchaseSet,'sem-id'), 'high',
      'Investigar o conjunto ' + rowName(noPurchaseSet,'sem nome'),
      'Gasto de ' + money(spendOf(noPurchaseSet)) + ', sem compras atribuídas. Contexto: ' + stageLabel(context.stage) + '.',
      'Verificar posicionamentos, segmentação e objetivo. Comparar com conjuntos do mesmo estágio antes de alterar o público.',
      'Medir custo por compra e qualidade das visitas no mesmo intervalo.',
      context.stage === 'unknown' ? 'Estágio não classificado: revisar segmentação' : 'Sinal atribuído; confirme amostra e janela'))
  }
  const underTarget = maxCAC ? eligibleSets.filter(r => count(r) >= 3 && cpa(r) <= maxCAC)
    .sort((a,b) => count(b) - count(a))[0] : null
  if (underTarget) {
    add(action('audiences', 'expand', underTarget.id || rowName(underTarget,'sem-id'), 'medium',
      'Testar expansão do conjunto ' + rowName(underTarget,'sem nome'),
      integer(count(underTarget)) + ' compras · custo por compra ' + money(cpa(underTarget)) + ' abaixo do limite de ' + money(maxCAC) + '.',
      'Duplicar para um teste de audiência ou ampliar gradualmente a distribuição, sem alterar criativo e público ao mesmo tempo.',
      'Manter custo por compra dentro do limite após aumento de amostra.',
      'Custo atribuído comparado à meta'))
  }
  if (!underTarget && !noPurchaseSet && eligibleSets.length) {
    const top = eligibleSets.slice().sort((a,b) => spendOf(b) - spendOf(a))[0]
    add(action('audiences', 'inspect', top.id || rowName(top,'sem-id'), 'info',
      'Revisar distribuição do principal conjunto',
      rowName(top,'Conjunto') + ' concentra ' + money(spendOf(top)) + ' em investimento no período.',
      'Verificar seu estágio de funil e comparar retorno de conjuntos semelhantes antes de transferir verba.',
      'Confirmar compras e CAC por conjunto; configurar CAC máximo para decisões econômicas.',
      'Sem limite confiável para recomendar redução ou escala'))
  }

  const eligibleCampaigns = campaigns.filter(r => spendOf(r) > 0)
  const inefficient = maxCAC ? eligibleCampaigns.filter(r => count(r) >= 3 && cpa(r) > maxCAC * 1.2)
    .sort((a,b) => cpa(b) - cpa(a))[0] : null
  if (inefficient) {
    add(action('campaigns', 'cost', inefficient.id || rowName(inefficient,'sem-id'), 'high',
      'Reavaliar verba de ' + rowName(inefficient,'campanha'),
      'Custo por compra ' + money(cpa(inefficient)) + ' com ' + integer(count(inefficient)) + ' compras, acima do limite de ' + money(maxCAC) + '.',
      'Investigar conjuntos e criativos responsáveis pelo custo. Considerar redução gradual após confirmar atribuição e vendas reais.',
      'Custo por compra voltar ao limite sem perder vendas incrementais.',
      'Regra econômica configurada pelo negócio'))
  }
  const efficient = maxCAC ? eligibleCampaigns.filter(r => count(r) >= 3 && cpa(r) <= maxCAC)
    .sort((a,b) => count(b) - count(a))[0] : null
  if (efficient) {
    add(action('campaigns', 'scale', efficient.id || rowName(efficient,'sem-id'), 'medium',
      'Avaliar escala de ' + rowName(efficient,'campanha'),
      integer(count(efficient)) + ' compras · custo por compra ' + money(cpa(efficient)) + ', dentro do limite configurado.',
      'Testar aumento gradual de verba, mantendo um grupo de controle. Não mudar criativos e segmentações simultaneamente.',
      'Acompanhar custo por compra, pedidos Shopify e MER antes de manter a expansão.',
      'Sinal de eficiência, não garantia de escala'))
  }
  const totalShopOrders = value(shop.shopify_orders)
  const totalSpend = value(shop.meta_spend)
  if (minMER > 0 && totalSpend > 0 && value(shop.mer) > 0 && value(shop.mer) < minMER) {
    add(action('campaigns', 'mer', shop.month_start || 'shopify', 'high',
      'Proteger retorno antes de ampliar a mídia',
      'MER Shopify de ' + num(shop.mer) + ' no mês ' + monthLabel(shop.month_start) + ', abaixo do mínimo de ' + num(minMER) + '.',
      'Conferir as campanhas com maior gasto e confrontar compras Meta com pedidos reais da Shopify.',
      'Reavaliar MER e pedidos do período comercial comparável.',
      'MER comercial não pode ser atribuído isoladamente a uma campanha'))
  }
  if (!output.campaigns.length && eligibleCampaigns.length) {
    add(action('campaigns', 'inspect', 'baseline', 'info',
      'Comparar retorno das campanhas antes de redistribuir verba',
      integer(eligibleCampaigns.length) + ' campanhas com investimento no período; ' + integer(totalShopOrders) + ' pedidos Shopify no mês ' + (shop.month_start ? monthLabel(shop.month_start) : 'mais recente') + '.',
      'Abrir campanhas e identificar quais concentram gasto e compras. Definir CAC máximo para liberar recomendações de escala e corte.',
      'Analisar CAC e MER com datas e atribuições compatíveis.',
      'Sem guardrail econômico configurado'))
  }
  for (const category of Object.keys(output)) {
    if (output[category].length) output[category].sort(byPriority)
    else output[category].push(action(category, 'waiting', 'empty', 'info',
      category === 'creatives' ? 'Ainda sem indicação criativa segura' : category === 'audiences' ? 'Ainda sem decisão segura sobre públicos' : 'Ainda sem decisão segura sobre campanhas',
      category === 'creatives' ? 'Não há criativos com amostra suficiente nas métricas recebidas.' : category === 'audiences' ? 'Não há dados comparáveis de conjuntos suficientes.' : 'Não há campanhas com investimento suficiente no retorno consultado.',
      'Verificar atualização e disponibilidade dos dados nesta área; não alterar verba sem evidência.',
      'Aguardar mais dados ou corrigir a integração.',
      'Amostra insuficiente'))
  }
  return output
}

const cardDescriptions = {
  creatives: 'Mensagens, vídeos e variações que precisam de teste.',
  audiences: 'Quem recebe a verba e onde o resultado muda.',
  campaigns: 'Investimento e retorno para orientar a distribuição.'
}

function Decision({item, onNavigate, checked, onToggle, compact=false}) {
  return <article className={'ac-decision ' + item.level + (checked ? ' is-reviewed' : '') + (compact ? ' compact' : '')}>
    <div className="ac-decision-head"><span className={'ac-priority ' + item.level}>{item.level === 'high' ? 'Prioridade alta' : item.level === 'medium' ? 'Oportunidade' : 'Acompanhar'}</span><small>{LABELS[item.group]} · {item.confidence}</small></div>
    <h3>{item.title}</h3><p className="ac-evidence">{item.evidence}</p>
    <div className="ac-advice"><strong>O que fazer</strong><p>{item.next}</p></div>
    {!compact && <div className="ac-validation"><strong>Como validar</strong><p>{item.validation}</p></div>}
    <div className="ac-decision-footer">
      <button className="ac-link" type="button" onClick={() => onNavigate(LINKS[item.group])}>Abrir {LABELS[item.group].toLowerCase()} <span aria-hidden="true">→</span></button>
      <button type="button" className={'ac-reviewed ' + (checked ? 'done' : '')} onClick={() => onToggle(item.id)}>{checked ? '✓ Revisado' : 'Marcar como revisado'}</button>
    </div>
  </article>
}

export default function ActionCenter({ data, onNavigate, onRefresh, isLoading }) {
  const [filter, setFilter] = useState('all')
  const [reviewed, setReviewed] = useState(readReviewed)
  const goals = readStrategy()
  const actions = useMemo(() => deriveRecommendations(data, goals), [data])
  const full = Object.values(actions).flat().sort(byPriority)
  const primary = full.find(item => item.level === 'high') || full.find(item => item.level === 'medium') || full[0]
  const displayed = filter === 'all' ? ['creatives','audiences','campaigns'].map(key => actions[key][0]).filter(Boolean) : actions[filter]
  const business = list(data?.shopify?.business).at(-1)
  const recent = sourceDate(data)
  const orders = value(business?.shopify_orders)
  const media = value(business?.meta_spend)
  const hasCommercialData = Boolean(business?.month_start)
  const period = business?.month_start ? monthLabel(business.month_start) : 'Indisponível'

  function toggle(id) {
    setReviewed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE, JSON.stringify(next)) } catch {}
      return next
    })
  }

  return <div className="page ac-page">
    <header className="ac-header">
      <div><span className="ac-eyebrow">SKIN BEAUTY / INTELIGÊNCIA DE PERFORMANCE</span><h1>O que fazer agora.</h1><p>O gestor analisa os sinais e coloca as próximas decisões na sua frente. Detalhes só quando você quiser investigar.</p></div>
      <button className="ac-refresh" type="button" onClick={onRefresh} disabled={isLoading}>{isLoading ? 'Atualizando…' : '↻ Atualizar análise'}</button>
    </header>
    <div className="ac-source"><span>Meta Ads · {recent ? 'dados até ' + recent.split('-').reverse().join('/') : 'data não informada'}</span><span>Shopify · {period}</span><span>Recomendações, sem alterações automáticas nas campanhas</span></div>

    <section className="ac-focus">
      <div className="ac-focus-main"><span>LEITURA PRIORITÁRIA</span><h2>{primary?.title || 'Aguardando métricas confiáveis'}</h2><p>{primary?.evidence || 'Sem leitura disponível no momento.'}</p><strong>Próximo passo</strong><p>{primary?.next || 'Revisar as integrações de dados.'}</p></div>
      <div className="ac-focus-aside">
        <div><span>RECEITA / SHOPIFY</span><strong>{hasCommercialData ? money(business.shopify_revenue) : '—'}</strong></div>
        <div><span>INVESTIMENTO / META</span><strong>{hasCommercialData ? money(media) : '—'}</strong></div>
        <div><span>PEDIDOS / SHOPIFY</span><strong>{hasCommercialData ? integer(orders) : '—'}</strong></div>
        <div className="ac-focus-foot"><span>MER do mês</span><strong>{hasCommercialData && media > 0 ? num(value(business.mer)) : '—'}</strong></div>
      </div>
    </section>
    <div className="ac-note">Os números do resumo são do mês comercial informado acima. As recomendações operacionais analisam o recorte disponível na Meta. Compras atribuídas pela Meta e pedidos Shopify não são a mesma métrica.</div>

    <section className="ac-choice-head"><div><span className="ac-eyebrow">PRÓXIMAS AÇÕES</span><h2>Três frentes. Decisões claras.</h2></div><button type="button" className="ac-strategy" onClick={() => onNavigate('strategy')}>Definir metas e limites →</button></section>
    <nav className="ac-filters" aria-label="Filtrar recomendações">{[['all','Visão rápida'],['creatives','Criativos'],['audiences','Públicos'],['campaigns','Campanhas']].map(([key,label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} aria-pressed={filter === key}>{label}</button>)}</nav>
    <div className="ac-decision-grid">
      {displayed.map(item => <Decision key={item.id} item={item} checked={!!reviewed[item.id]} onToggle={toggle} onNavigate={onNavigate} compact={filter === 'all'}/>)}
    </div>
    {filter === 'all' && <div className="ac-shortcuts">{Object.entries(LABELS).map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)}><span>{label}</span><small>{cardDescriptions[key]}</small><b>Ver recomendações →</b></button>)}</div>}
    <footer className="ac-footer"><p><strong>Como o gestor decide?</strong> Usa compras, custo e atenção; considera os limites definidos em Estratégia e evita recomendar cortes ou aumentos sem base comparável. “Revisado” registra apenas uma anotação neste navegador, não executa ações na Meta.</p><button type="button" onClick={() => onNavigate('manager')}>Abrir diagnóstico completo →</button></footer>
  </div>
}
