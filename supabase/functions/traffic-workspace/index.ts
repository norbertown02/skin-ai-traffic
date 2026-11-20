const base = Deno.env.get('SUPABASE_URL');
const defaultKey = key => { try { return JSON.parse(Deno.env.get(key) || '{}').default } catch { return null } };
const publicKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY');
const privateKey = defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const account = '2985215308420830';
const allowedOrigin = origin => /^https:\/\/skin-ai-traffic1(?:-[a-z0-9-]+-nutrialle-s-projects|-nutrialle-s-projects)?\.vercel\.app$/.test(origin)
  || /^http:\/\/(?:localhost|127\.0\.0\.1):(4173|5173)$/.test(origin);
const allowedKeys = new Set(['revenue_target','orders_target','media_budget','max_cac','min_mer','target_conversion','target_ticket','growth_target','acquisition_pct','retargeting_pct','testing_pct','primary_objective','strategy_notes','target_margin_pct','break_even_roas','target_profit_pct']);
const str = (value,max=240) => String(value ?? '').trim().slice(0,max);
const safeNumber = value => { const n = Number(value || 0); if(!Number.isFinite(n) || n<0 || n>100000000) throw new Error('Número fora dos limites permitidos'); return n; };
const parseDate = value => { if(!value) return null; if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0,10)!==value) throw new Error('Data inválida'); return value; };
const authHeaders = () => {
  const h = new Headers({'apikey':privateKey,'Content-Type':'application/json'});
  if (!privateKey.startsWith('sb_secret_')) h.set('Authorization','Bearer '+privateKey);
  return h;
};
async function database(table,params={},method='GET',body) {
  const url = new URL('/rest/v1/'+table,base);
  url.search = new URLSearchParams(params).toString();
  const headers=authHeaders();
  headers.set('Prefer','return=representation,resolution=merge-duplicates');
  const resp=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!resp.ok) { console.error('workspace_rest_failure',table,resp.status); throw new Error('Falha ao consultar o espaço de trabalho'); }
  return resp.status===204 ? [] : await resp.json();
}
async function identity(request) {
  const bearer=request.headers.get('Authorization')||'';
  if(!bearer.startsWith('Bearer ')) return null;
  const response=await fetch(new URL('/auth/v1/user',base),{headers:{apikey:publicKey,Authorization:bearer},signal:AbortSignal.timeout(8000)});
  if(!response.ok) return null;
  const user=await response.json();
  return user.id && user.app_metadata?.skin_report_account_id===account ? user.id : null;
}
function product(input,user) {
  if(!input || !str(input.sku,100)) throw new Error('SKU obrigatório');
  return { account_id:account,sku:str(input.sku,100).toUpperCase(), product_name:str(input.product_name,180),
    selling_price:safeNumber(input.selling_price),product_cost:safeNumber(input.product_cost),
    packaging_cost:safeNumber(input.packaging_cost),shipping_subsidy:safeNumber(input.shipping_subsidy),
    tax_pct:safeNumber(input.tax_pct),payment_pct:safeNumber(input.payment_pct),
    refund_pct:safeNumber(input.refund_pct),updated_by:user,updated_at:new Date().toISOString() };
}
function item(input,user) {
  if(!input || str(input.title,240).length<3) throw new Error('Informe um título com pelo menos 3 caracteres');
  const kind=['experiment','decision','task'].includes(input.kind)?input.kind:'experiment';
  const status=['planned','running','validating','completed','cancelled'].includes(input.status)?input.status:'planned';
  return {account_id:account, kind,title:str(input.title,240),hypothesis:str(input.hypothesis,1500),
   entity_type:str(input.entity_type,80), entity_id:str(input.entity_id,100),
   primary_metric:str(input.primary_metric,100),
   baseline_start:parseDate(input.baseline_start),baseline_end:parseDate(input.baseline_end),
   test_start:parseDate(input.test_start),test_end:parseDate(input.test_end),
   status,outcome:str(input.outcome,3000),notes:str(input.notes,3000),
   updated_by:user,updated_at:new Date().toISOString()};
}
Deno.serve(async request => {
 const origin=request.headers.get('Origin');
 const headers=new Headers({'Cache-Control':'private, no-store','Vary':'Origin',
   'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info'});
 if(origin && allowedOrigin(origin)) headers.set('Access-Control-Allow-Origin',origin);
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 if(origin && !allowedOrigin(origin)) return reply({error:'Origem não autorizada'},403);
 if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(request.method)) return reply({error:'Método inválido'},405);
 const user=await identity(request);
 if(!user) return reply({error:'unauthorized'},401);
 try {
   if(request.method==='GET') {
     const [settings,products,items,tags,events,customerMix,productMix]=await Promise.all([
       database('traffic_workspace_settings',{account_id:'eq.'+account,select:'settings,updated_at'}),
       database('traffic_product_economics',{account_id:'eq.'+account,select:'id,sku,product_name,selling_price,product_cost,packaging_cost,shipping_subsidy,tax_pct,payment_pct,refund_pct,updated_at',order:'product_name.asc'}),
       database('traffic_work_items',{account_id:'eq.'+account,select:'id,kind,title,hypothesis,entity_type,entity_id,primary_metric,baseline_start,baseline_end,test_start,test_end,status,outcome,notes,created_at,updated_at',order:'created_at.desc',limit:'200'}),
       database('traffic_creative_tags',{account_id:'eq.'+account,select:'creative_id,concept,role,updated_at'}),
       database('traffic_entity_change_events',{account_id:'eq.'+account,select:'entity_type,entity_id,entity_name,captured_on,change_types',order:'captured_on.desc',limit:'100'}),
       database('traffic_shopify_customer_mix',{shop_domain:'eq.9a70ec-cf.myshopify.com',select:'month_start,segment,orders,total_sales,synced_at,through_date',order:'month_start.asc',limit:'200'}),
       database('traffic_shopify_product_mix',{shop_domain:'eq.9a70ec-cf.myshopify.com',select:'month_start,product_name,orders,total_sales,net_items_sold,synced_at,through_date',order:'month_start.asc',limit:'500'})
     ]);
     return reply({settings:settings[0]?.settings??{},settings_updated_at:settings[0]?.updated_at??null,products,items,tags,events,customerMix,productMix});
   }
   const body=await request.json();
   if(!body || typeof body!=='object') return reply({error:'Payload inválido'},400);
   if(body.action==='save_settings') {
     if(!body.settings || typeof body.settings!=='object' || Array.isArray(body.settings)) throw new Error('Configuração inválida');
     const clean={};
     for(const [k,v] of Object.entries(body.settings)) {
       if(!allowedKeys.has(k)) continue;
       clean[k]=typeof v==='number'||typeof v==='string'||typeof v==='boolean'?v:null;
     }
     await database('traffic_workspace_settings',{on_conflict:'account_id'},'POST',
       {account_id:account,settings:clean,updated_by:user,updated_at:new Date().toISOString()});
     return reply({ok:true});
   }
   if(body.action==='save_product') {
     const values=product(body.product,user);
     const out=await database('traffic_product_economics',{on_conflict:'account_id,sku'},'POST',values);
     return reply({ok:true,item:out?.[0]??null});
   }
   if(body.action==='delete_product') {
     const sku=str(body.sku,100).toUpperCase();
     if(!sku) throw new Error('SKU obrigatório');
     await database('traffic_product_economics',{account_id:'eq.'+account,sku:'eq.'+sku},'DELETE');
     return reply({ok:true});
   }
   if(body.action==='save_item') {
     const values=item(body.item,user);
     let out;
     if(body.item?.id) {
       if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.item.id)) throw new Error('Identificador inválido');
       out=await database('traffic_work_items',{id:'eq.'+body.item.id,account_id:'eq.'+account},'PATCH',values);
       if(!out.length) return reply({error:'Registro não encontrado'},404);
     } else {
       out=await database('traffic_work_items',{},'POST',{...values,created_by:user});
     }
     return reply({ok:true,item:out[0]});
   }
   if(body.action==='delete_item') {
     const id=str(body.id,50);
     if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) throw new Error('Identificador inválido');
     await database('traffic_work_items',{id:'eq.'+id,account_id:'eq.'+account},'DELETE');
     return reply({ok:true});
   }
   if(body.action==='save_creative_tag') {
     const creative_id=str(body.creative_id,100);
     const concept=str(body.concept,40),role=str(body.role,40);
     if(!creative_id || !['pain','benefit','demonstration','social_proof','offer','product','education','comparison','lifestyle'].includes(concept)
        || !['attention','education','consideration','conversion'].includes(role)) throw new Error('Classificação inválida');
     await database('traffic_creative_tags',{on_conflict:'account_id,creative_id'},'POST',{
       account_id:account,creative_id,concept,role,updated_by:user,updated_at:new Date().toISOString()
     });
     return reply({ok:true});
   }
   if(body.action==='delete_creative_tag') {
     const creative_id=str(body.creative_id,100);
     if(!creative_id) throw new Error('Criativo obrigatório');
     await database('traffic_creative_tags',{account_id:'eq.'+account,creative_id:'eq.'+creative_id},'DELETE');
     return reply({ok:true});
   }
   return reply({error:'Ação desconhecida'},400);
 } catch(error) {
   if(error instanceof SyntaxError || /inválid|obrigat|limites|título/.test(error?.message||'')) return reply({error:error.message},400);
   console.error('workspace_api_failure',error?.message);
   return reply({error:'Não foi possível concluir a operação'},503);
 }
});