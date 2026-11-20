import test from 'node:test'
import assert from 'node:assert/strict'
import {SHOP_DOMAIN,API_VERSION,orderRows,chooseSyncWindow,orderFilter,validateShopifyPage} from '../supabase/functions/shopify-order-sync/sync.mjs'

test('Shopify order ingestion keeps only minimal operational fields, pseudonymizes identity and handles refunds', async()=>{
 const raw={
  id:'gid://shopify/Order/123',name:'#123',
  processedAt:'2026-11-19T18:00:00Z',updatedAt:'2026-11-20T11:00:00Z',cancelledAt:null,
  currencyCode:'BRL',sourceName:'web',displayFinancialStatus:'PARTIALLY_REFUNDED',
  currentTotalPriceSet:{shopMoney:{amount:'92.25',currencyCode:'BRL'}},
  customer:{id:'gid://shopify/Customer/42',email:'do-not-store@example.com'},
  customerJourneySummary:{ready:true,customerOrderIndex:2,
    lastVisit:{utmParameters:{source:'facebook',medium:'paid_social',campaign:'novembro'}}},
  lineItems:{pageInfo:{hasNextPage:false},nodes:[{
   id:'gid://shopify/LineItem/4',sku:'SKIN-01',title:'Stick',quantity:2,currentQuantity:1,
   discountedTotalSet:{shopMoney:{amount:'65.11'}},
   product:{id:'gid://shopify/Product/7'},variant:{id:'gid://shopify/ProductVariant/8'}
  }]}
 }
 const {entry,items}=await orderRows(raw)
 assert.equal(entry.shop_domain,SHOP_DOMAIN)
 assert.equal(entry.total_amount,92.25)
 assert.equal(entry.customer_order_index,2)
 assert.equal(entry.utm_source,'facebook')
 assert.equal(entry.customer_key.length,64)
 assert.equal(entry.customer_key, (await orderRows(raw)).entry.customer_key)
 assert.ok(!JSON.stringify(entry).includes('do-not-store@example.com'))
 assert.ok(!JSON.stringify(entry).includes('gid://shopify/Customer/42'))
 assert.equal(items[0].current_quantity,1)
 assert.equal(items[0].total_amount,65.11)
 assert.equal(items[0].sku,'SKIN-01')
 assert.equal(API_VERSION,'2026-10')
})
test('Shopify cursor and checkpoint always use a fixed upper bound and a 48-hour overlap',()=>{
 const first=chooseSyncWindow({backfill_from:'2026-09-01T00:00:00Z'},new Date('2026-11-20T12:00:00Z'))
 assert.equal(first.from,'2026-09-01T00:00:00Z')
 assert.equal(first.end,'2026-11-20T12:00:00.000Z')
 const overlap=chooseSyncWindow({last_success_at:'2026-11-20T12:00:00Z'},new Date('2026-11-20T13:00:00Z'))
 assert.equal(overlap.from,'2026-11-18T12:00:00.000Z')
 const resumable=chooseSyncWindow({cursor_since:'2026-10-01T00:00:00Z',cursor_window_end:'2026-10-15T01:00:00Z',cursor_after:'opaque'},new Date('2026-11-20T13:00:00Z'))
 assert.deepEqual(resumable,{from:'2026-10-01T00:00:00Z',end:'2026-10-15T01:00:00Z',after:'opaque'})
 assert.match(orderFilter(resumable),/updated_at:>=2026-10-01/)
})
test('Shopify feed never accepts malformed or GraphQL error responses',()=>{
 assert.throws(()=>validateShopifyPage({errors:[{message:'invalid'}]}),/shopify_graphql_error/)
 assert.throws(()=>validateShopifyPage({data:{orders:{nodes:[{id:123}]}}}),/shopify_missing_order_fields/)
 assert.equal(validateShopifyPage({data:{orders:{nodes:[],pageInfo:{hasNextPage:false}}}}).nodes.length,0)
})
test('Order worker rejects missing cron proof and remains paused until credentials are authorized',async()=>{
 const priorDeno=globalThis.Deno,priorFetch=globalThis.fetch
 let handler,queries=0
 const token='test-credential-used-only-in-tests-12345'
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(v=>v.toString(16).padStart(2,'0')).join('')
 globalThis.Deno={serve:cb=>{handler=cb},env:{get:k=>({
  SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'unit-service'
 })[k]}}
 globalThis.fetch=async(url)=>{
  const u=new URL(String(url))
  queries++
  assert.equal(u.pathname,'/rest/v1/shopify_sync_config')
  assert.equal(u.searchParams.get('shop_domain'),'eq.'+SHOP_DOMAIN)
  return Response.json([{shop_domain:SHOP_DOMAIN,enabled:false,cron_key_sha256:hash}])
 }
 try{
  await import('../supabase/functions/shopify-order-sync/index.ts')
  assert.equal((await handler(new Request('https://unit.supabase.co/functions/v1/shopify-order-sync',{method:'GET'}))).status,405)
  assert.equal((await handler(new Request('https://unit.supabase.co/functions/v1/shopify-order-sync',{method:'POST'}))).status,401)
  const paused=await handler(new Request('https://unit.supabase.co/functions/v1/shopify-order-sync',{method:'POST',headers:{'x-shopify-sync-key':token}}))
  assert.equal(paused.status,200)
  assert.equal((await paused.json()).status,'paused')
  assert.equal(queries,2)
 }finally{
  globalThis.Deno=priorDeno;globalThis.fetch=priorFetch
 }
})
