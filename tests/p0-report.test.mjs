import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, periodFromRuns } from '../supabase/functions/traffic-report/report.mjs'
import { classifyAudience, inspectUtm } from '../supabase/functions/traffic-report/quality.mjs'
import { classifyFunnelContext } from '../src/lib/funnelContext.js'

const interval = (from,to) => new URLSearchParams({ since:from,until:to })
const runs = [{ stream:'ads',date_from:'2026-09-01',date_to:'2026-11-18' }]
const source = {
  daily:[{ date:'2026-11-04',ad_id:'a',spend:100,purchases:3,revenue:220 }],
  previousDaily:[{ ad_id:'a',spend:50,purchases:2,revenue:100 }],
  placements:[], audience:[], campaigns:[],
  ads:[{ id:'a',creative_id:'c',ad_set_id:'s',name:'Anúncio' }],
  sets:[{ id:'s',name:'Carrinho',targeting:{geo_locations:{countries:['BR']}} }],
  creatives:[{ id:'c',configuration:{url_tags:'utm_source=fb&utm_medium=paid-social&utm_campaign=promo&token=private'} }],
  monthly:[{ month_start:'2026-11-01',meta_through_date:'2026-11-18',meta_reach:250 }],
  business:[{ month_start:'2026-11-01',shopify_through_date:'2026-11-18',currency:'BRL',shopify_orders:8,shopify_revenue:500 }],
}

test('buildReport compares equal durations and reconciles matching commercial windows', () => {
  const period = periodFromRuns(runs,interval('2026-11-01','2026-11-30'))
  assert.deepEqual(period.previous,{start:'2026-10-14',end:'2026-10-31',days:18,available:true})
  const report = buildReport(source,period)
  assert.equal(report.bootstrap.performance.periods.previous.spend,50)
  assert.equal(report.shopify.business[0].purchase_gap,-5)
  assert.equal(report.shopify.business[0].revenue_gap,-280)
  assert.equal(report.shopify.business[0].mer,5)
  assert.equal(report.funnel.months[0].reach,250)
  assert.equal(report.utm.counts.nonstandard,1)
  assert.ok(!JSON.stringify(report).includes('token=private'))
})

test('partial filter suppresses monthly Shopify and reach while keeping daily Meta totals', () => {
  const report = buildReport(source,periodFromRuns(runs,interval('2026-11-03','2026-11-13')))
  assert.equal(report.shopify.business[0].meta_spend,100)
  assert.equal(report.shopify.business[0].has_shopify,false)
  assert.equal(report.shopify.business[0].mer,null)
  assert.equal(report.funnel.months[0].reach,null)
})

test('gaps in coverage suppress comparison and invalid dates fail', () => {
  const split = [...runs,{stream:'ads',date_from:'2026-08-19',date_to:'2026-08-20'}]
  const period = periodFromRuns(split,interval('2026-09-01','2026-09-15'))
  assert.equal(period.previous.available,false)
  assert.equal(buildReport(source,period).bootstrap.performance.periods.previous,null)
  assert.throws(()=>periodFromRuns(split,interval('2026-02-30','2026-03-05')),RangeError)
})

test('audience classification uses included evidence and preserves ambiguity', () => {
  const classify = targeting=>classifyAudience({id:'s',targeting})
  assert.equal(classify({custom_audiences:[{name:'Lookalike 1%'}]}).type,'Lookalike')
  assert.equal(classify({custom_audiences:[{name:'Lookalike 1%'},{name:'Clientes'}]}).type,'Não classificado')
  assert.equal(classify({excluded_custom_audiences:[{name:'Remarketing'}]}).type,'Não classificado')
  assert.equal(classify({targeting_automation:{advantage_audience:1}}).type,'Advantage+')
  assert.equal(classifyFunnelContext({name:'Carrinho',audience_type:'Não classificado',audience_evidence:'Sem evidência'}).stage,'unknown')
})

test('UTM checks missing, conflicting and dynamic values without returning URLs', () => {
  assert.equal(inspectUtm().status,'unavailable')
  assert.equal(inspectUtm({url_tags:'utm_source=facebook&UTM_MEDIUM=paid_social&utm_campaign=promo'}).status,'nonstandard')
  assert.equal(inspectUtm({url_tags:'utm_source=facebook&utm_source=instagram'}).status,'conflict')
  assert.equal(inspectUtm({url_tags:'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}'}).status,'dynamic')
  assert.deepEqual(inspectUtm({url_tags:'utm_source=facebook'}).missing,['utm_medium','utm_campaign'])
})
