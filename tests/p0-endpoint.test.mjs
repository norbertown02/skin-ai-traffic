import test from 'node:test'
import assert from 'node:assert/strict'

test('Edge endpoint authorizes account, scopes Shopify and uses the prior window', async () => {
  let handler
  let account = 'unrelated'
  const requests = []
  const originalFetch = globalThis.fetch
  globalThis.Deno = {
    serve: callback => { handler = callback },
    env:{ get:key=>({SUPABASE_URL:'https://fixture.test',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-private'})[key] },
  }
  globalThis.fetch = async input => {
    const url = new URL(input)
    requests.push(url)
    if (url.pathname === '/auth/v1/user') return Response.json({id:'user',app_metadata:{skin_report_account_id:account}})
    if (url.pathname.endsWith('/sync_runs')) return Response.json([{stream:'ads',date_from:'2026-10-01',date_to:'2026-11-18'}])
    if (url.pathname.endsWith('/traffic_business_monthly')) {
      assert.equal(url.searchParams.get('shop_domain'),'eq.9a70ec-cf.myshopify.com')
      assert.ok(!url.searchParams.get('select').includes('*'))
    }
    return Response.json([])
  }
  try {
    await import('../supabase/functions/traffic-report/index.ts')
    const url = 'https://fixture.test/functions/v1/traffic-report-p0-preview?since=2026-11-01&until=2026-11-18'
    const headers = {Origin:'https://skin-ai-traffic1-p0-nutrialle-s-projects.vercel.app'}
    assert.equal((await handler(new Request(url,{method:'OPTIONS',headers}))).status,204)
    assert.equal((await handler(new Request(url,{headers}))).status,401)
    headers.Authorization = 'Bearer fixture'
    assert.equal((await handler(new Request(url,{headers}))).status,403)
    assert.equal(requests.length,1)
    account = '2985215308420830'
    const response = await handler(new Request(url,{headers}))
    assert.equal(response.status,200)
    assert.equal(response.headers.get('Cache-Control'),'private, no-store')
    const report = await response.json()
    assert.equal(report.bootstrap.performance.comparison.days,18)
    const media = requests.filter(url=>url.pathname.endsWith('/ad_metrics_daily'))
    assert.deepEqual(media.map(url=>url.searchParams.get('and')),[
      '(date.gte.2026-11-01,date.lte.2026-11-18)',
      '(date.gte.2026-10-14,date.lte.2026-10-31)',
    ])
  } finally {
    globalThis.fetch = originalFetch
    delete globalThis.Deno
  }
})
