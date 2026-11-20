import {SHOP_DOMAIN,API_VERSION,ORDERS_QUERY,orderRows,validateShopifyPage,chooseSyncWindow,orderFilter} from './sync.mjs'

const supabaseUrl=Deno.env.get('SUPABASE_URL')
const envDefault=key=>{try{return JSON.parse(Deno.env.get(key)||'{}').default}catch{return null}}
const serviceKey=envDefault('SUPABASE_SECRET_KEYS')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const storeDomain=SHOP_DOMAIN
const safeError=error=>String(error?.message||'shopify_sync_failed').replace(/[^a-z0-9_]/gi,'_').slice(0,90)
const internalHeaders=()=>{
 if(!serviceKey)throw Error('supabase_service_key_missing')
 const headers=new Headers({'apikey':serviceKey,'Content-Type':'application/json'})
 if(!serviceKey.startsWith('sb_secret_'))headers.set('Authorization','Bearer '+serviceKey)
 return headers
}
async function database(table,options={}){
 const url=new URL('/rest/v1/'+table,supabaseUrl)
 for(const [key,value] of Object.entries(options.query??{}))url.searchParams.set(key,String(value))
 const headers=internalHeaders()
 headers.set('Prefer',options.prefer||'return=representation')
 const res=await fetch(url,{method:options.method||'GET',headers,
  body:options.data===undefined?undefined:JSON.stringify(options.data),
  signal:AbortSignal.timeout(15000)})
 if(!res.ok)throw Error('database_'+table+'_'+res.status)
 if(res.status===204)return []
 const data=await res.json().catch(()=>[])
 return Array.isArray(data)?data:[]
}
async function updateConfig(values){
 await database('shopify_sync_config',{method:'PATCH',
  query:{shop_domain:'eq.'+storeDomain},data:{...values,updated_at:new Date().toISOString()},
  prefer:'return=minimal'})
}
function bytesConstantTimeMatch(a,b){
 if(a.length!==b.length)return false
 let bad=0
 for(let i=0;i<a.length;i++)bad|=a.charCodeAt(i)^b.charCodeAt(i)
 return bad===0
}
async function requireCronToken(request,storedHash){
 const provided=request.headers.get('x-shopify-sync-key')
 if(!provided||provided.length<24||provided.length>256||!storedHash)return false
 const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(provided))
 const digest=[...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('')
 return bytesConstantTimeMatch(digest,storedHash)
}
async function getShopifyAccessToken(){
 const id=Deno.env.get('SHOPIFY_CLIENT_ID'),secret=Deno.env.get('SHOPIFY_CLIENT_SECRET')
 if(!id||!secret)throw Error('credentials_missing')
 const response=await fetch('https://'+storeDomain+'/admin/oauth/access_token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:id,client_secret:secret,grant_type:'client_credentials'}),
  signal:AbortSignal.timeout(12000)
 })
 if(!response.ok)throw Error(response.status===403?'shop_not_permitted':'shopify_auth_'+response.status)
 const result=await response.json()
 if(!result.access_token)throw Error('shopify_token_missing')
 if(!String(result.scope??'').split(',').some(s=>s.trim()==='read_orders'))throw Error('read_orders_scope_missing')
 return result.access_token
}
async function fetchPage(accessToken,window){
 const response=await fetch('https://'+storeDomain+'/admin/api/'+API_VERSION+'/graphql.json',{
  method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':accessToken},
  body:JSON.stringify({query:ORDERS_QUERY,variables:{after:window.after,filter:orderFilter(window)}}),
  signal:AbortSignal.timeout(20000)
 })
 if(!response.ok)throw Error(response.status===429?'shopify_rate_limited':'shopify_api_'+response.status)
 return validateShopifyPage(await response.json())
}
async function closeRun(id,status,count,errorCode){
 if(!id)return
 await database('sync_runs',{method:'PATCH',query:{id:'eq.'+id},
  data:{status,rows_written:count,error_code:errorCode??null,finished_at:new Date().toISOString()},
  prefer:'return=minimal'})
}
Deno.serve(async request=>{
 const reply=(result,status=200)=>Response.json(result,{status,headers:{'Cache-Control':'no-store'}})
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405)
 if(!supabaseUrl||!serviceKey)return reply({error:'unavailable'},503)
 let config
 try{
  const rows=await database('shopify_sync_config',{query:{shop_domain:'eq.'+storeDomain,select:'shop_domain,enabled,last_success_at,backfill_from,cursor_since,cursor_after,cursor_window_end,cron_key_sha256'}})
  config=rows[0]
  if(!config)return reply({error:'missing_config'},503)
  if(!(await requireCronToken(request,config.cron_key_sha256)))return reply({error:'unauthorized'},401)
  if(!config.enabled)return reply({status:'paused',source:'shopify',ready:false})
 }catch(error){return reply({error:safeError(error)},503)}
 let runId=null,processed=0
 try{
  const token=await getShopifyAccessToken()
  const now=new Date()
  const window=chooseSyncWindow(config,now)
  await updateConfig({last_started_at:now.toISOString(),last_error_code:null,last_error_at:null})
  // Recover a worker stopped before it closed its previous run.
  await database('sync_runs',{method:'PATCH',
   query:{source_id:'eq.shopify',scope_id:'eq.'+storeDomain,stream:'eq.orders',status:'eq.running',
    started_at:'lt.'+new Date(Date.now()-20*60000).toISOString()},
   data:{status:'error',error_code:'stale_worker',finished_at:new Date().toISOString()},
   prefer:'return=minimal'})
  const started=await database('sync_runs',{method:'POST',data:{
   source_id:'shopify',scope_id:storeDomain,stream:'orders',date_from:window.from.slice(0,10),
   date_to:window.end.slice(0,10),status:'running',rows_written:0,started_at:new Date().toISOString()
  }})
  runId=started[0]?.id
  if(!runId)throw Error('sync_lock_busy')
  let next={...window},finished=false
  for(let i=0;i<3;i++){
   const page=await fetchPage(token,next)
   const rows=await Promise.all(page.nodes.map(orderRows))
   const orders=rows.map(r=>r.entry),items=rows.flatMap(r=>r.items)
   if(orders.length){
    await database('shopify_orders',{method:'POST',
     query:{on_conflict:'shop_domain,id'},data:orders,prefer:'resolution=merge-duplicates,return=minimal'})
   }
   if(items.length){
    await database('shopify_order_items',{method:'POST',
     query:{on_conflict:'shop_domain,order_id,id'},data:items,prefer:'resolution=merge-duplicates,return=minimal'})
   }
   processed+=orders.length
   next.after=page.pageInfo?.endCursor??null
   await updateConfig({cursor_since:window.from,cursor_window_end:window.end,
    cursor_after:page.pageInfo?.hasNextPage?next.after:null})
   if(!page.pageInfo?.hasNextPage){finished=true;break}
   if(!next.after)throw Error('shopify_cursor_missing')
  }
  if(finished){
   await updateConfig({last_success_at:window.end,cursor_since:null,cursor_window_end:null,
    cursor_after:null,last_processed_count:processed,last_error_code:null,last_error_at:null})
  }
  await closeRun(runId,'success',processed,null)
  return reply({status:finished?'success':'partial',orders:processed,source:'shopify'})
 }catch(error){
  const code=safeError(error)
  try{
   await updateConfig({last_error_code:code,last_error_at:new Date().toISOString()})
   await closeRun(runId,'error',processed,code)
  }catch(_){/* Avoid leaking credentials and order payloads into logs. */}
  return reply({status:'error',error:code},503)
 }
})