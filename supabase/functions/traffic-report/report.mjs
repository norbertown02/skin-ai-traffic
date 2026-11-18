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
  const covered = (stream) => {
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
  if (!covered('ads')) throw new RangeError('O histórico de anúncios tem lacunas no período selecionado.')
  return {
    start, end, first: dates.first, last: dates.last, requestedEnd: rawUntil ?? end,
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
    const type = setRow.audience_type ?? (
      Array.isArray(targeting.custom_audiences) && targeting.custom_audiences.some((item) => /lookalike|semelhante/i.test(item?.name ?? '')) ? 'Lookalike' : null
    )
    return {
      ad_id: adId, ad_name: row.name, status: row.effective_status,
      campaign_id: row.campaign_id, campaign_name: campaignRow.name,
      ad_set_id: row.ad_set_id, ad_set_name: setRow.name,
      creative_id: row.creative_id, creative_name: creative.get(row.creative_id)?.name ?? 'Criativo sem vínculo',
      type: type ?? 'Não classificado', audience_type: type,
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
  const creativeProfiles = group(withContext, (r) => r.creative_id && ({ key:r.creative_id })).flatMap(({ key, ...values }) => {
    const row = creative.get(key)
    return row ? [{ ...row, metrics:values, audiences:audiencesByCreative.get(key) ?? [], placements:placementsByCreative.get(key) ?? [] }] : []
  })
  const byType = group(withContext, (r) => ({ key:r.type, name:r.type }))
  const ag = source.audience.filter((r) => r.breakdown === 'age_gender')
  const genders = { female:'Feminino', male:'Masculino', unknown:'Não informado' }
  const genderLabel = (r) => genders[r.gender] ?? r.gender ?? 'Não informado'
  const ageLabel = (r) => r.age || 'Não informada'
  const total = sum(withContext)
  const funnel = source.monthly.map((row) => ({
    month_start:row.month_start, through_date:row.meta_through_date,
    reach:row.meta_reach, frequency:row.frequency,
    ...metrics({
      spend:row.meta_spend, impressions:row.meta_impressions, clicks:row.meta_clicks,
      link_clicks:row.meta_link_clicks, landing_page_views:row.meta_lpv, add_to_cart:row.meta_add_to_cart,
      checkouts:row.meta_checkouts, purchases:row.meta_purchases, revenue:row.meta_revenue,
    }),
  }))
  const shopify = new Map(source.business.filter((row) => row.shop_domain).map((row) => [row.month_start,row]))
  const business = source.monthly.map((row) => {
    const commercial = shopify.get(row.month_start)
    return {
      ...commercial, month_start:row.month_start, meta_spend:row.meta_spend, meta_roas:row.meta_roas,
      meta_through_date:row.meta_through_date, meta_purchases:row.meta_purchases, meta_revenue:row.meta_revenue,
      has_shopify:Boolean(commercial),
      conversion_rate:commercial?.conversion_rate == null ? null : n(commercial.conversion_rate) / 100,
      cart_additions:commercial?.sessions_with_cart, reached_checkout:commercial?.sessions_reached_checkout,
      completed_checkout:commercial?.sessions_converted,
    }
  })
  return {
    bootstrap:{
      main:{ period, cur:{ k:total, ads, sets, campaigns }, daily, audienceRows:sets, audienceSummary:{ by_type:byType } },
      performance:{ daily, periods:{ current:total, current30:total } },
    },
    shopify:{ business, available:shopify.size > 0 },
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
      waste:{available:false},
    },
    manager:{ decisions:[], quality:[
      { name:'Cobertura diária do Meta Ads',status:'ok',message:period.start+' a '+period.end },
      { name:'Shopify',status:shopify.size > 0 ? 'ok' : 'pending',message:shopify.size > 0 ? 'Dados comerciais disponíveis.' : 'A nova base ainda não tem dados comerciais.' },
    ] },
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
