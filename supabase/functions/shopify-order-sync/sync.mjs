export const SHOP_DOMAIN='9a70ec-cf.myshopify.com'
export const API_VERSION='2026-10'
export const ORDERS_QUERY = `query SyncOrders($after:String,$filter:String!){
 orders(first:50,after:$after,query:$filter,sortKey:UPDATED_AT,reverse:false){
  pageInfo{hasNextPage endCursor}
  nodes{
   id name processedAt updatedAt cancelledAt currencyCode sourceName displayFinancialStatus
   currentTotalPriceSet{shopMoney{amount currencyCode}}
   customer{id}
   customerJourneySummary{ready customerOrderIndex lastVisit{utmParameters{source medium campaign}} firstVisit{utmParameters{source medium campaign}}}
   lineItems(first:80){pageInfo{hasNextPage} nodes{id sku title quantity currentQuantity discountedTotalSet{shopMoney{amount}} product{id} variant{id}}}
  }
 }
}`
const finite=(value)=>Number.isFinite(Number(value))?Number(value):0
const short=(value,limit=180)=>typeof value==='string'?value.slice(0,limit):null
export async function anonymousCustomerKey(domain,id){
 if(!id)return null
 const data=new TextEncoder().encode(domain+'|'+id)
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data))
 return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('')
}
export async function orderRows(order){
 const journey=order.customerJourneySummary
 const utm=journey?.lastVisit?.utmParameters??journey?.firstVisit?.utmParameters
 const entry={
  shop_domain:SHOP_DOMAIN,id:order.id,order_name:short(order.name,60),
  processed_at:order.processedAt,source_updated_at:order.updatedAt,
  currency:order.currencyCode,total_amount:finite(order.currentTotalPriceSet?.shopMoney?.amount),
  cancelled_at:order.cancelledAt,
  financial_status:short(order.displayFinancialStatus,50),
  source_name:short(order.sourceName,100),
  customer_key:await anonymousCustomerKey(SHOP_DOMAIN,order.customer?.id),
  customer_order_index:Number.isInteger(journey?.customerOrderIndex)?journey.customerOrderIndex:null,
  utm_source:short(utm?.source),utm_medium:short(utm?.medium),utm_campaign:short(utm?.campaign,220),
  attribution_ready:journey?.ready===true,
  line_items_complete:!order.lineItems?.pageInfo?.hasNextPage,
  synced_at:new Date().toISOString()
 }
 const items=(order.lineItems?.nodes??[]).map(item=>({
  shop_domain:SHOP_DOMAIN,order_id:order.id,id:item.id,
  product_id:item.product?.id??null,variant_id:item.variant?.id??null,
  sku:short(item.sku,120),title:short(item.title,350),
  quantity:Number(item.quantity||0),current_quantity:Number(item.currentQuantity||0),
  total_amount:finite(item.discountedTotalSet?.shopMoney?.amount)
 }))
 return {entry,items}
}
export function validateShopifyPage(payload){
 if(payload?.errors?.length)throw new Error('shopify_graphql_error')
 const orders=payload?.data?.orders
 if(!orders||!Array.isArray(orders.nodes))throw new Error('shopify_malformed_response')
 if(orders.nodes.some(x=>!x.id||!x.updatedAt||!x.processedAt))throw new Error('shopify_missing_order_fields')
 return orders
}
export function chooseSyncWindow(config, now=new Date()){
 const end=config.cursor_window_end??now.toISOString()
 const from=config.cursor_since??(config.last_success_at
   ?new Date(new Date(config.last_success_at).getTime()-48*3600000).toISOString()
   :new Date(config.backfill_from??now.getTime()-60*86400000).toISOString())
 return {from,end,after:config.cursor_after??null}
}
export function orderFilter({from,end}){
 return 'updated_at:>='+from+' updated_at:<='+end
}
