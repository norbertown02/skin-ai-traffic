const norm=v=>String(v||'').toLowerCase()
const n=v=>Number(v||0)

export const FUNNEL_STAGES=[
  ['top','Topo'],
  ['middle','Meio'],
  ['bottom','Fundo'],
  ['customer','Clientes'],
  ['mixed','Misto'],
  ['unknown','Não classificado'],
]

export const stageLabel=key=>FUNNEL_STAGES.find(x=>x[0]===key)?.[1]||'Não classificado'

const hotPattern=/(add.?to.?cart|atc\b|initiate.?checkout|checkout|carrinho|abandono|abandon|hot\b|quente|remark.*cart|retarget.*cart|ic\b)/i
const customerPattern=/(purchase|purchaser|buyer|comprador|cliente|customer|buyers|clientes|recompra|upsell|cross.?sell)/i
const warmPattern=/(website.?visitor|visitor|visitante|view.?content|vc\b|engag|instagram|ig.?engag|facebook.?engag|video.?viewer|viewer|morno|warm|remark|retarget|site|pageview)/i
const coldPattern=/(broad|aberto|open|advantage\+?.?audience|lookalike|lal\b|interest|interesse|prospect|cold|frio)/i
const mixedPattern=/(advantage\+?.?(shopping|sales)|asc\b|mixed|misto)/i

function textOf(row={}){
  return [
    row.campaign_name,row.campaign,row.name,row.ad_set_name,row.adset_name,row.set_name,
    row.audience_type,row.type,row.targeting_type,row.audience_name,row.custom_audience_name,
    row.inclusions,row.exclusions,row.optimization_goal,row.objective
  ].map(norm).join(' ')
}

export function classifyFunnelContext(row={}){
  const hay=textOf(row)
  const explicit=norm(row.funnel_stage||row.stage)
  if(['top','middle','bottom','customer','mixed'].includes(explicit)) return {stage:explicit,confidence:100,reason:'Classificação explícita da estrutura.'}

  if(mixedPattern.test(hay)) return {stage:'mixed',confidence:86,reason:'Estrutura Advantage+/mista pode combinar prospecção e remarketing.'}
  if(hotPattern.test(hay)) return {stage:'bottom',confidence:94,reason:'Audiência indica intenção forte: carrinho, checkout ou abandono.'}
  if(customerPattern.test(hay)) return {stage:'customer',confidence:92,reason:'Audiência indica compradores/clientes.'}
  if(warmPattern.test(hay)) return {stage:'middle',confidence:86,reason:'Audiência indica visitantes, engajados ou viewers.'}
  if(coldPattern.test(hay)) return {stage:'top',confidence:88,reason:'Audiência indica prospecção: broad, interesse ou lookalike.'}

  // Se a API já resumiu o tipo de público, aproveita sem depender do nome.
  const t=norm(row.audience_type||row.type||row.targeting_type)
  if(t==='retargeting'||t==='remarketing') return {stage:'middle',confidence:78,reason:'Tipo de público informado como remarketing sem evento de intenção forte.'}
  if(t==='prospecting'||t==='broad'||t==='interest'||t==='lookalike') return {stage:'top',confidence:82,reason:'Tipo de público informado como prospecção.'}

  return {stage:'unknown',confidence:35,reason:'Os dados atuais não expõem targeting suficiente para classificar com segurança.'}
}

export function summarizeContexts(rows=[]){
  const map={top:0,middle:0,bottom:0,customer:0,mixed:0,unknown:0}
  const spend={top:0,middle:0,bottom:0,customer:0,mixed:0,unknown:0}
  for(const row of rows||[]){
    const {stage}=classifyFunnelContext(row)
    map[stage]=(map[stage]||0)+1
    spend[stage]=(spend[stage]||0)+n(row.spend)
  }
  const ordered=['top','middle','bottom','customer','mixed','unknown']
  const dominant=ordered.slice().sort((a,b)=>(spend[b]||0)-(spend[a]||0))[0]||'unknown'
  return {count:map,spend,dominant,total:(rows||[]).length}
}
