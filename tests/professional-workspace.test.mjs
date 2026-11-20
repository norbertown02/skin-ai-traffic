import test from 'node:test'
import assert from 'node:assert/strict'

test('Workspace v2 validates origin, user scope and write boundaries', async () => {
 const originalFetch=globalThis.fetch
 const originalDeno=globalThis.Deno
 let handler
 let authorized=true
 const traffic=[]
 const writes=[]
 const account='2985215308420830'
 globalThis.Deno={serve:callback=>{handler=callback},env:{get:key=>({
   SUPABASE_URL:'https://test-supabase.invalid',
   SUPABASE_ANON_KEY:'fixture-public',
   SUPABASE_SERVICE_ROLE_KEY:'fixture-private'
 })[key]}}
 globalThis.fetch=async(url,opts={})=>{
   const u=new URL(String(url))
   traffic.push(u)
   if(u.pathname==='/auth/v1/user') return Response.json({id:'u-1',app_metadata:{skin_report_account_id:authorized?account:'other-account'}})
   if(u.pathname.startsWith('/rest/v1/')){
     if(!['POST'].includes(opts.method)) assert.equal(u.searchParams.get('account_id'),'eq.'+account)
     if(opts.method==='POST'||opts.method==='PATCH'||opts.method==='DELETE'){
       writes.push({url:u,method:opts.method,payload:opts.body?JSON.parse(opts.body):null})
       if(opts.method==='PATCH')return Response.json([])
       if(opts.method==='DELETE')return Response.json([])
       return Response.json([{id:'fixture'}])
     }
     if(u.pathname.endsWith('/traffic_workspace_settings'))return Response.json([{settings:{revenue_target:9000}}])
     return Response.json([])
   }
   throw Error('Unexpected network request: '+u.pathname)
 }
 try {
   await import('../supabase/functions/traffic-workspace/index.ts')
   const url='https://test-supabase.invalid/functions/v1/traffic-workspace-v2-preview'
   const origin='https://skin-ai-traffic1-abc-nutrialle-s-projects.vercel.app'
   assert.equal((await handler(new Request(url,{headers:{Origin:'https://attacker.example'}}))).status,403)
   assert.equal((await handler(new Request(url,{headers:{Origin:origin}}))).status,401)
   authorized=false
   assert.equal((await handler(new Request(url,{headers:{Origin:origin,Authorization:'Bearer fixture'}}))).status,401)
   authorized=true
   const res=await handler(new Request(url,{headers:{Origin:origin,Authorization:'Bearer fixture'}}))
   assert.equal(res.status,200)
   const payload=await res.json()
   assert.equal(payload.settings.revenue_target,9000)
   assert.deepEqual(payload.products,[])
   assert.deepEqual(payload.tags,[])
   assert.ok(traffic.some(u=>u.pathname.endsWith('/traffic_entity_change_events')))
   const write=await handler(new Request(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer fixture', 'Content-Type':'application/json'},
       body:JSON.stringify({action:'save_settings',settings:{revenue_target:8000,account_id:'malicious',admin_key:'secret',testing_pct:10}})}))
   assert.equal(write.status,200)
   assert.equal(writes.at(-1).payload.account_id,account)
   assert.deepEqual(writes.at(-1).payload.settings,{revenue_target:8000,testing_pct:10})
   const malformed=await handler(new Request(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer fixture','Content-Type':'application/json'},
     body:JSON.stringify({action:'save_creative_tag',creative_id:'1',role:'unknown',concept:'offer'})}))
   assert.equal(malformed.status,400)
   assert.equal(writes.length,1)
   const cross=await handler(new Request(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer fixture','Content-Type':'application/json'},
     body:JSON.stringify({action:'save_item',item:{id:'00000000-0000-4000-a000-000000000001',title:'Important test',kind:'experiment'}})}))
   assert.equal(cross.status,404)
   assert.equal(writes.at(-1).url.searchParams.get('account_id'),'eq.'+account)
   assert.ok(!traffic.some(u=>u.hostname.endsWith('facebook.com')))
 } finally {
   globalThis.fetch=originalFetch
   globalThis.Deno=originalDeno
 }
})
