import { classifyAudience, inspectUtm } from './quality.mjs'

const metricKeys = [
  'spend', 'impressions', 'clicks', 'link_clicks', 'landing_page_views', 'add_to_cart',
  'checkouts', 'purchases', 'revenue', 'video_plays', 'video_25', 'video_50', 'video_75',
  'video_95', 'video_100',
]

export const addDays = (day, offset) => new Date(Date.parse(day) + offset * 86400000).toISOString().slice(0, 10)
const n = (value) => Number(value) || 0
const ratio = (a, b) => b > 0 ? a / b : null
const rate = (a, b) => b > 0 ? a * 100 / b : null

function metrics(total) {
  const { spend, impressions, clicks, link_clicks, purchases, revenue, landing_page_views, add_to_cart, checkouts } = total
  return {
    ...total,
    imp: impressions, pur: purchases, rev: revenue,
    ctr: rate(clicks, impressions), link_ctr: rate(link_clicks, impressions),
    cpc: ratio(spend, clicks), link_cpc: ratio(spend, link_clicks),
    cpm: ratio(spend * 1000, impressions), cac: ratio(spend, purchases), roas: ratio(revenue, spend),
    lpv_rate: rate(landing_page_views, link_clicks ?? clicks),
    adds_to_cart: add_to_cart, initiates_checkout: checkouts,
    click_to_lpv: rate(landing_page_views, link_clicks ?? clicks),
    lpv_to_cart: rate(add_to_cart, landing_page_views), cart_to_checkout: rate(checkouts, add_to_cart),
    checkout_to_purchase: rate(purchases, checkouts),
  }
}

function group(rows, identify) {
  const buckets = new Map()
  for (const row of rows) {
    const dimension = identify(row)
    if (!dimension) continue
    const { key, ...labels } = dimension
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, ...labels, totals: {} }
      buckets.set(key, bucket)
    }
    for (const field of metricKeys) {
      if (row[field] != null) bucket.totals[field] = (bucket.totals[field] ?? 0) + n(row[field])
    }
  }
  return [...buckets.values()].map(({ totals, ...labels }) => ({ ...labels, ...metrics(totals) }))
    .sort((a, b) => n(b.spend) - n(a.spend))
}

function sum(rows) {
  return group(rows, () => ({ key: 'total' }))[0] ?? metrics({})
}

function covers(runs, stream, start, end) {
    let cursor = start
    const sorted = runs.filter((row) => row.stream === stream)
      .sort((a, b) => a.date_from.localeCompare(b.date_from))
    for (const row of sorted) {
      if (row.date_to < cursor) continue
      if (row.date_from > cursor) break
      cursor = addDays(row.date_to, 1)
      if (cursor > end) return true
    }
    return false
  }

export function periodFromRuns(runs, params) {
  const ads = runs.filter((row) => row.stream === 'ads')
  if (!ads.length) return null
  const dates = ads.reduce((acc, row) => ({
    first: row.date_from < acc.first ? row.date_from : acc.first,
    last: row.date_to > acc.last ? row.date_to : acc.last,
  }), { first: ads[0].date_from, last: ads[0].date_to })
  const rawSince = params.get('since')
  const rawUntil = params.get('until')
  const rawDays = params.get('days') ?? '30'
  const dateOK = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d)) && addDays(d, 0) === d
  if (Boolean(rawSince) !== Boolean(rawUntil) ||
      (rawSince && (!dateOK(rawSince) || !dateOK(rawUntil) || rawSince > rawUntil)) ||
      !/^\d{1,3}$/.test(rawDays) || +rawDays < 1 || +rawDays > 366) {
    throw new RangeError('Selecione um intervalo válido de até 366 dias.')
  }

  const end = rawUntil && rawUntil < dates.last ? rawUntil : dates.last
  const desiredStart = rawSince ?? addDays(end, 1 - Number(rawDays))
  const start = !rawSince && desiredStart < dates.first ? dates.first : desiredStart
  if (start < dates.first || start > end || Date.parse(end) - Date.parse(start) >= 366 * 86400000) {
    throw new RangeError('O intervalo está fora do histórico disponível.')
  }
  const covered = (stream) => covers(runs, stream, start, end)
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
  const previous = { start:addDays(start, -days), end:addDays(start, -1), days }
  previous.available = covers(runs, 'ads', previous.start, previous.end)
  if (!covered('ads')) throw new RangeError('O histórico de anúncios tem lacunas no período selecionado.')
  return {
    start, end, days, previous, first: dates.first, last: dates.last, requestedEnd: rawUntil ?? end,
    coverage: Object.fromEntries(['ads', 'age_gender', 'region', 'placements'].map((s) => [s, covered(s)])),
  }
}

export function buildReport(source, period) {
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]))
  const ad = byId(source.ads)
  const campaign = byId(source.campaigns)
  const set = byId(source.sets)
  const creative = byId(source.creatives)
  const knownContext = (adId) => {
    const row = ad.get(adId) ?? {}
    const setRow = set.get(row.ad_set_id) ?? {}
    const campaignRow = campaign.get(row.campaign_id) ?? {}
    const targeting = setRow.targeting ?? {}
    const classification = classifyAudience(setRow)
    return {
      ad_id: adId, ad_name: row.name, status: row.effective_status,
      campaign_id: row.campaign_id, campaign_name: campaignRow.name,
      ad_set_id: row.ad_set_id, ad_set_name: setRow.name,
      creative_id: row.creative_id, creative_name: creative.get(row.creative_id)?.name ?? 'Criativo sem vínculo',
      type: classification.type, audience_type: classification.type, audience_evidence: classification.evidence,
      age: targeting.age_min || targeting.age_max ? [targeting.age_min, targeting.age_max].filter(Boolean).join('–') : null,
      gender: targeting.genders?.length === 1 ? ({1:'Masculino',2:'Feminino'}[targeting.genders[0]] ?? null) : null,
    }
  }
  const withContext = source.daily.map((row) => ({ ...row, ...knownContext(row.ad_id) }))
  const byDay = new Map(group(withContext, (r) => ({ key: r.date, date: r.date })).map((row) => [row.date, row]))
  const daily = []
  for (let day = period.start; day <= period.end; day = addDays(day, 1)) {
    daily.push(byDay.get(day) ?? { date: day })
  }
  const ads = group(withContext, (r) => ({ key:r.ad_id, id:r.ad_id, name:r.ad_name, ...knownContext(r.ad_id) }))
  const campaigns = group(withContext, (r) => r.campaign_id && ({
    key:r.campaign_id, id:r.campaign_id, name:r.campaign_name, status:campaign.get(r.campaign_id)?.effective_status,
  }))
  const sets = group(withContext, (r) => r.ad_set_id && ({
    ...knownContext(r.ad_id), key:r.ad_set_id, id:r.ad_set_id, name:r.ad_set_name,
    status:set.get(r.ad_set_id)?.effective_status,
  }))
  const creativeAudience = group(withContext, (r) => r.creative_id && ({
    ...knownContext(r.ad_id), key:JSON.stringify([r.creative_id,r.ad_set_id]),
  }))
  const creativePlacement = group(source.placements, (r) => {
    const context = knownContext(r.ad_id)
    const { creative_id, ad_set_id } = context
    if (!creative_id) return null
    return {
      ...context, key:JSON.stringify([creative_id,ad_set_id,r.publisher_platform,r.platform_position]),
      publisher_platform:r.publisher_platform, platform_position:r.platform_position,
    }
  })
  const indexContexts = (rows) => {
    const map = new Map()
    for (const row of rows) {
      if (!map.has(row.creative_id)) map.set(row.creative_id, [])
      map.get(row.creative_id).push(row)
    }
    return map
  }
  const audiencesByCreative = indexContexts(creativeAudience)
  const placementsByCreative = indexContexts(creativePlacement)
  // Include every catalog creative, including pieces with no delivery in the selected period.
  // Campaign status is a CURRENT snapshot, whereas metrics are historical.
  const creativeMetricMap = new Map(group(withContext, (r) => r.creative_id && ({ key:r.creative_id })).map(({key,...values})=>[String(key),values]))
  const creativeAds = new Map()
  for (const adRow of source.ads) {
    if (!adRow.creative_id) continue
    const key=String(adRow.creative_id)
    if(!creativeAds.has(key)) creativeAds.set(key,[])
    creativeAds.get(key).push({id:adRow.id,name:adRow.name,status:adRow.effective_status,
      campaign_id:adRow.campaign_id,ad_set_id:adRow.ad_set_id})
  }
  const creativeProfiles = source.creatives.map(row=>{
    const linkedAds=creativeAds.get(String(row.id))||[]
    const values=creativeMetricMap.get(String(row.id))||metrics({})
    const active=linkedAds.some(ad=>ad.status==='ACTIVE')
    const delivered=n(values.impressions)>0||n(values.spend)>0
    const { configuration, ...publicCreative } = row
    return {...publicCreative, metrics:values, ads:linkedAds, ad_count:linkedAds.length,
      active, delivered, current_status:active?'ACTIVE':linkedAds.length?'INACTIVE':'UNLINKED',
      audiences:audiencesByCreative.get(row.id)??[], placements:placementsByCreative.get(row.id)??[]}
  }).sort((a,b)=>n(b.metrics?.spend)-n(a.metrics?.spend))
  const byType = group(withContext, (r) => ({ key:r.type, name:r.type }))
  const ag = source.audience.filter((r) => r.breakdown === 'age_gender')
  const genders = { female:'Feminino', male:'Masculino', unknown:'Não informado' }
  const genderLabel = (r) => genders[r.gender] ?? r.gender ?? 'Não informado'
  const ageLabel = (r) => r.age || 'Não informada'
  const total = sum(withContext)
  // Observed exposure, not an estimate of financial loss. Never automatically recommend pausing.
  const ctrReference = n(total.link_ctr || total.ctr)
  const wasteItems = ads.filter(item=>n(item.spend)>=60 && n(item.purchases)===0)
    .map(item=>{
      const attention=ctrReference>0 && n(item.link_ctr || item.ctr)<ctrReference*.7
      return {
        id:item.id, type:attention?'Atenção':'Pós-clique',
        creative_name:item.creative_name, ad_name:item.name, estimated_waste:n(item.spend),
        reason:attention?'CTR de link abaixo de 70% da média do período, sem compras atribuídas.':'Investimento sem compras atribuídas; verificar página, oferta e rastreamento.',
        action:attention?'Revisar gancho, visual e público antes de alterar a verba.':'Verificar LPV, oferta, checkout e atribuição; não pausar apenas por este sinal.',
        category:attention?'attention':'post_click'
      }
    }).sort((a,b)=>b.estimated_waste-a.estimated_waste)
  const waste = {available:true,items:wasteItems,summary:{
    estimated_total:wasteItems.reduce((sum,item)=>sum+item.estimated_waste,0),
    counts:{attention:wasteItems.filter(x=>x.category==='attention').length,
      post_click:wasteItems.filter(x=>x.category==='post_click').length,
      audience_mismatch:0,placement_mismatch:0}
  }}
  const monthly = new Map(source.monthly.map(row => [row.month_start, row]))
  const shopify = new Map(source.business.map(row => [row.month_start, row]))
  const funnel = []
  const business = []
  let mismatches = 0
  let checked = 0
  for (let month = period.start.slice(0,7)+'-01'; month <= period.end;
    month = addDays(month, 32).slice(0,7)+'-01') {
    const next = addDays(month, 32).slice(0,7)+'-01'
    const start = month < period.start ? period.start : month
    const end = addDays(next, -1) < period.end ? addDays(next, -1) : period.end
    const monthMetrics = sum(withContext.filter(row => row.date >= start && row.date <= end))
    const snapshot = monthly.get(month)
    const alignedMeta = start === month && snapshot?.meta_through_date === end
    const rawShopify = shopify.get(month)
    const commercial = start === month && rawShopify?.shopify_through_date === end && rawShopify.currency === 'BRL' ? rawShopify : null
    const { spend, roas, revenue, purchases } = monthMetrics
    if (alignedMeta && spend != null && snapshot.meta_spend != null) {
      checked++
      if (Math.abs(spend - snapshot.meta_spend) >= 0.01 ||
          (purchases != null && snapshot.meta_purchases != null && Math.abs(purchases - snapshot.meta_purchases) >= 0.001)) mismatches++
    }
    const aligned = Boolean(commercial)
    const orders = commercial?.shopify_orders
    const sales = commercial?.shopify_revenue

    funnel.push({
      month_start:month, start, through_date:end,
      reach:alignedMeta ? snapshot.meta_reach : null,
      frequency:alignedMeta ? snapshot.frequency : null,
      ...monthMetrics,
    })
    business.push({
      month_start:month, start, meta_through_date:end, meta_spend:spend, meta_roas:roas,
      meta_purchases:purchases, meta_revenue:revenue,
      shopify_revenue:sales, shopify_orders:orders, sessions:commercial?.sessions,
      shopify_through_date:rawShopify?.shopify_through_date, shopify_synced_at:rawShopify?.shopify_synced_at,
      has_shopify:aligned,
      comparison_status:aligned ? 'aligned' : rawShopify ? 'different_window' : 'missing',
      purchase_gap:aligned && orders != null && purchases != null ? purchases-orders : null,
      revenue_gap:aligned && sales != null && revenue != null ? revenue-sales : null,
      mer:aligned && sales != null ? ratio(sales,spend) : null,
      cac:aligned && spend != null ? ratio(spend,orders) : null,
      conversion_rate:commercial?.conversion_rate == null ? null : n(commercial.conversion_rate) / 100,
      cart_additions:commercial?.sessions_with_cart, reached_checkout:commercial?.sessions_reached_checkout,
      completed_checkout:commercial?.sessions_converted,
    })
  }
  const statuses = {}
  const utmByCreative = new Map(source.creatives.map(row => [row.id, inspectUtm(row.configuration)]))
  const utms = ads.map(row => {
    const check = utmByCreative.get(row.creative_id) ?? inspectUtm()
    statuses[check.status] = (statuses[check.status] ?? 0) + 1
    return { id:row.id, name:row.ad_name, spend:row.spend, ...check }
  })
  const previous = period.previous?.available ? sum(source.previousDaily ?? []) : null
  const sourceDates = source.sourceDates ?? {}
  const quality = Object.entries(period.coverage).map(([key, covered]) => ({
    name:({ ads:'Entrega Meta', age_gender:'Idade e gênero', region:'Regiões', placements:'Posicionamentos' })[key],
    status:covered?'ok':'warning', message:covered?'Cobertura integral do filtro':'Histórico com cobertura incompleta no filtro',
  }))
  quality.push(
    { name:'Comparação de mídia', status:previous?'ok':'warning',
      message:previous?'Janela anterior coberta':'Sem cobertura integral na janela anterior de mesma duração' },
    { name:'Meta diário × consolidado', status:checked && !mismatches?'ok':'warning',
      message:checked?mismatches+' de '+checked+' janelas com divergência em gasto ou compras':'Nenhum consolidado com a mesma cobertura para validar' },
    { name:'Shopify no filtro', status:business.every(row=>row.has_shopify)?'ok':'warning',
      message:business.filter(row=>row.has_shopify).length+' de '+business.length+' intervalos mensais com datas alinhadas' },
    { name:'Segmentação', status:byType.some(row=>row.key==='Não classificado')?'warning':'ok',
      message:'Classificação pela configuração atual. Gasto sem classificação: '+(byType.find(row=>row.key==='Não classificado')?.spend ?? 0).toFixed(2)+' BRL' },
  )
  return {
    bootstrap:{
      main:{ period, cur:{ k:total, ads, sets, campaigns }, daily, audienceRows:sets, audienceSummary:{ by_type:byType } },
      performance:{ daily, periods:{ current:total, current30:total, previous }, comparison:period.previous },
    },
    shopify:{ business, available:business.some(row=>row.has_shopify), monthly_only:true, period_compatible:business.some(row=>row.has_shopify) },
    funnel:{ months:funnel },
    audience:{
      total,
      by_age:group(ag, (r) => ({key:ageLabel(r)})),
      by_gender:group(ag, (r) => ({key:genderLabel(r)})),
      age_gender:group(ag, (r) => ({key:ageLabel(r)+' · '+genderLabel(r),age:ageLabel(r),gender:genderLabel(r)})),
      by_region:group(source.audience.filter((r) => r.breakdown === 'region'), (r) => ({key:r.region || 'Não informada'})),
    },
    deep:{
      creative_profiles:creativeProfiles, benchmarks:{avg_ctr:total.ctr},
      cross:{creative_audience:creativeAudience,creative_placement_set:creativePlacement},
      placements:group(source.placements, (r) => ({key:r.publisher_platform+' · '+r.platform_position})),
      waste,
    },
    utm:{ counts:statuses, ads:utms },
    sources:sourceDates,
    manager:{ decisions:[], quality },
  }
}

export function videoSummary(profile) {
  const m = profile?.metrics
  const plays = m?.video_plays
  return {
    available:plays > 0,
    is_video:Boolean(profile?.video_id || plays > 0),
    plays, play_rate_pct:rate(plays,m?.impressions),
    retention_pct:Object.fromEntries([25,50,75,95,100].map((step) => ['p'+step, m?.['video_'+step] == null ? null : rate(m['video_'+step],plays)])),
  }
}
