const normalize = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const list = (items) => Array.isArray(items) ? items : []
const has = (items) => list(items).length > 0

export function classifyAudience(set) {
  const unknown = (evidence) => ({ type:'Não classificado', evidence })
  if (!set?.id) return unknown('Conjunto sem vínculo')
  const declared = {
    lookalike:'Lookalike', semelhante:'Lookalike', remarketing:'Remarketing',
    retargeting:'Remarketing', broad:'Amplo', amplo:'Amplo', interests:'Interesses', interesses:'Interesses',
  }[normalize(set.audience_type)]
  if (declared) return { type:declared, evidence:'Classificação cadastrada' }
  const target = set.targeting
  if (!target || !Object.keys(target).length) return unknown('Segmentação indisponível')
  if (Number(target.targeting_automation?.advantage_audience) === 1) {
    return { type:'Advantage+', evidence:'Advantage+ ativo na configuração atual' }
  }
  const included = target.custom_audiences
  if (has(included)) {
    const similar = included.filter(item => item?.lookalike_spec || /\b(lookalike|semelhante)\b/.test(normalize(item?.name)))
    if (similar.length === included.length) return { type:'Lookalike', evidence:'Públicos incluídos com evidência de semelhança' }
    if (similar.length) return unknown('Públicos semelhantes e personalizados no mesmo conjunto')
    if (included.every(item => /\b(remarketing|retargeting)\b/.test(normalize(item?.name)))) {
      return { type:'Remarketing', evidence:'Públicos incluídos identificados como remarketing pelo nome' }
    }
    return { type:'Personalizado', evidence:'Públicos personalizados incluídos, origem comercial indeterminada' }
  }
  const interests = (spec) => has(spec?.interests)
  if (interests(target) || (Array.isArray(target.flexible_spec) && target.flexible_spec.some(interests))) {
    return { type:'Interesses', evidence:'Interesses na configuração atual' }
  }
  return unknown('Sem evidência suficiente para classificar')
}

const required = ['utm_source','utm_medium','utm_campaign']
const aliases = { utm_source:{ fb:'facebook', ig:'instagram' }, utm_medium:{ 'paid-social':'paid_social', 'paid social':'paid_social', paidsocial:'paid_social' } }
const parameterBags = (value) => {
  if (!value || typeof value !== 'string') return []
  try { return [new URL(value).searchParams] }
  catch { return [/^https?:/i.test(value) ? new URLSearchParams() : new URLSearchParams(value)] }
}

export function inspectUtm(config) {
  const story = config?.object_story_spec
  const feed = config?.asset_feed_spec
  const destinations = [
    story?.link_data?.link,
    story?.link_data?.call_to_action?.value?.link,
    story?.video_data?.call_to_action?.value?.link,
    ...list(story?.link_data?.child_attachments).map(item => item?.link),
    ...list(feed?.link_urls).map(item => item?.website_url),
  ].filter(value => typeof value === 'string' && value)
  const tags = parameterBags(config?.url_tags)
  if (!destinations.length && !tags.length) return { status:'unavailable', missing:[], keys:[] }
  let nonstandard = false
  const checks = (destinations.length ? destinations : ['']).map(destination => {
    const values = new Map()
    for (const bag of [...parameterBags(destination), ...tags]) {
      for (const [key, value] of bag) {
        const name = normalize(key)
        if (!required.includes(name)) continue
        if (!values.has(name)) values.set(name, new Set())
        const cleaned = normalize(value)
        const alias = aliases[name]
        const canonical = alias && Object.hasOwn(alias,cleaned) ? alias[cleaned] : cleaned
        if (value && (name !== key || canonical !== value) && !/\{\{/.test(value)) nonstandard = true
        values.get(name).add(canonical)
      }
    }
    return values
  })
  const missing = required.filter(key => checks.some(values => ![...values.get(key) ?? []].some(Boolean)))
  const keys = required.filter(key => checks.some(values => values.has(key)))
  const combined = required.map(key => new Set(checks.flatMap(values => [...values.get(key) ?? []].filter(Boolean))))
  const conflict = combined.some(values => values.size > 1)
  const dynamic = combined.some(values => [...values].some(value => /\{\{|\}\}/.test(value)))
  return { status:conflict?'conflict':missing.length?'incomplete':dynamic?'dynamic':nonstandard?'nonstandard':'complete', missing, keys }
}
