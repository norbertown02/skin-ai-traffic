import React, { useMemo, useState } from 'react'
import { Badge, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { cleanCreativeName, delta, integer, money, num, pct } from '../lib/format.js'
import { classifyFunnelContext, stageLabel, summarizeContexts } from '../lib/funnelContext.js'

const n=v=>Number(v||0)
const arr=v=>Array.isArray(v)?v:[]
const STRATEGY_KEY='skin_growth_strategy_v1'
const MESSAGE_KEY='skin_creative_message_v2'

const readLocal=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
const change=(a,b)=>delta(n(a),n(b))
const higherBad=(a,b,t=12)=>{const d=change(a,b);return d!==null&&d>=t}
const lowerBad=(a,b,t=12)=>{const d=change(a,b);return d!==null&&d<=-t}
const safeName=v=>String(v||'—')

const conceptLabels={pain:'Dor',benefit:'Benefício',demonstration:'Demonstração',social_proof:'Prova social',offer:'Oferta',product:'Produto',education:'Educação',comparison:'Comparação',lifestyle:'Lifestyle'}
const roleLabels={attention:'Atenção',education:'Educação',consideration:'Consideração',conversion:'Conversão'}

function inferConcept(item){
  const hay=`${item?.name||''} ${item?.headline||''} ${item?.primary_text||''} ${item?.hook||''}`.toLowerCase()
  if(/desconto|oferta|ganhe|leve|frete|cupom|promo|kit/.test(hay)) return 'offer'
  if(/depoimento|cliente|review|avalia|resultado real|prova/.test(hay)) return 'social_proof'
  if(/como usar|aplica|textura|demonstra|passo a passo/.test(hay)) return 'demonstration'
  if(/versus|vs\b|compar|melhor que/.test(hay)) return 'comparison'
  if(/por que|entenda|saiba|aprenda|dica/.test(hay)) return 'education'
  if(/problema|poros|oleos|seca|mancha|acne|irrita/.test(hay)) return 'pain'
  if(/benef|hidrata|protege|reduz|melhora|luminos|maciez/.test(hay)) return 'benefit'
  if(/rotina|dia a dia|lifestyle|necessaire/.test(hay)) return 'lifestyle'
  return 'product'
}
function inferRole(concept){
  if(concept==='offer') return 'conversion'
  if(['social_proof','demonstration','comparison','education'].includes(concept)) return 'consideration'
  if(['pain','benefit','lifestyle'].includes(concept)) return 'attention'
  return 'education'
}
function tone(level){return level==='critical'?'danger':level==='attention'?'warning':level==='healthy'?'success':'neutral'}
function stateLabel(level){return level==='critical'?'Gargalo':level==='attention'?'Atenção':level==='healthy'?'Saudável':'Amostra insuficiente'}
function stageFromDiagnostic(key){return ['acquisition','attention'].includes(key)?'top':key==='intent'?'middle':key==='conversion'?'bottom':'business'}

function Metric({label,value,note}){return <div className="tm-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
function DecisionCard({title,item,toneName}){
  if(!item) return null
  return <article className={`tm-action-card ${toneName||''}`}>
    <div className="tm-action-head"><span>{title}</span><Badge tone={item.priority==='Alta'?'danger':item.priority==='Média'?'warning':'neutral'}>{item.priority}</Badge></div>
    <h3>{item.what}</h3>
    <p>{item.why}</p>
    <dl><div><dt>Onde</dt><dd>{item.where}</dd></div><div><dt>Risco</dt><dd>{item.risk}</dd></div><div><dt>Validar por</dt><dd>{item.validate}</dd></div></dl>
  </article>
}

export default function ManagerDeep({data,onRefresh}){
  const deep=data?.deep||{}, business=arr(data?.shopify?.business), funnelMonths=arr(data?.funnel?.months)
  const current=business.at(-1)||{}, previous=business.length>1?business.at(-2):{}
  const funnel=funnelMonths.find(x=>x.month_start===current.month_start)||funnelMonths.at(-1)||{}
  const prevFunnel=funnelMonths.find(x=>x.month_start===previous.month_start)||funnelMonths.at(-2)||{}
  const profiles=arr(deep?.creative_profiles)
  const sets=arr(data?.bootstrap?.main?.cur?.sets||data?.bootstrap?.main?.audienceRows)
  const strategy=readLocal(STRATEGY_KEY)
  const messageMap=readLocal(MESSAGE_KEY)
  const [selectedContext,setSelectedContext]=useState('auto')

  const revenue=n(current.shopify_revenue), orders=n(current.shopify_orders), spend=n(current.meta_spend), sessions=n(current.sessions)
  const cac=orders?spend/orders:0, mer=n(current.mer), conversion=n(current.conversion_rate)*100, ticket=orders?revenue/orders:0
  const maxCac=n(strategy.max_cac), minMer=n(strategy.min_mer), budget=n(strategy.media_budget), revenueTarget=n(strategy.revenue_target)

  const creativeContexts=useMemo(()=>profiles.flatMap(profile=>{
    const concept=messageMap[profile.id]?.concept||inferConcept(profile)
    const role=messageMap[profile.id]?.role||inferRole(concept)
    const rows=arr(profile.audiences)
    return rows.map((row,i)=>{
      const ctx=classifyFunnelContext(row)
      return {...row,_stage:ctx.stage,_confidence:ctx.confidence,_reason:ctx.reason,_creativeId:profile.id,_creativeName:cleanCreativeName(profile.name,'Criativo'),_concept:concept,_role:role,_format:profile.format||profile.media_type||profile.type||'—',_key:`${profile.id}-${i}`}
    })
  }),[profiles,messageMap])

  const setContexts=useMemo(()=>sets.map((row,i)=>{const ctx=classifyFunnelContext(row);return {...row,_stage:ctx.stage,_confidence:ctx.confidence,_reason:ctx.reason,_key:`set-${i}`}}),[sets])
  const contextSource=creativeContexts.length?creativeContexts:setContexts
  const contextSummary=useMemo(()=>summarizeContexts(contextSource),[contextSource])

  const counts={
    impressions:n(funnel.impressions), clicks:n(funnel.link_clicks||funnel.clicks), lpv:n(funnel.landing_page_views), atc:n(funnel.adds_to_cart), checkout:n(funnel.checkouts||funnel.initiate_checkouts), purchases:n(funnel.purchases||orders)
  }

  const diagnostics=useMemo(()=>{
    const cpm=n(funnel.cpm), ctr=n(funnel.ctr), cpc=n(funnel.cpc), freq=n(funnel.frequency)
    const clickLpv=n(funnel.click_to_lpv), lpvCart=n(funnel.lpv_to_cart), cartCheckout=n(funnel.cart_to_checkout), checkoutPurchase=n(funnel.checkout_to_purchase)
    const prevConv=n(previous.conversion_rate)*100
    const rows=[]

    const acquisitionIssues=[]
    if(higherBad(cpm,prevFunnel.cpm,15)) acquisitionIssues.push(`CPM subiu ${num(change(cpm,prevFunnel.cpm),1)}%`)
    if(higherBad(freq,prevFunnel.frequency,20)) acquisitionIssues.push(`frequência subiu ${num(change(freq,prevFunnel.frequency),1)}%`)
    rows.push({key:'acquisition',name:'Aquisição',funnel:'Topo',metric:'CPM',value:money(cpm),sample:counts.impressions>=3000,issues:acquisitionIssues,level:counts.impressions<3000?'insufficient':acquisitionIssues.length>=2?'critical':acquisitionIssues.length?'attention':'healthy'})

    const attentionIssues=[]
    if(lowerBad(ctr,prevFunnel.ctr,12)) attentionIssues.push(`CTR caiu ${num(Math.abs(change(ctr,prevFunnel.ctr)),1)}%`)
    if(higherBad(cpc,prevFunnel.cpc,15)) attentionIssues.push(`CPC subiu ${num(change(cpc,prevFunnel.cpc),1)}%`)
    rows.push({key:'attention',name:'Atenção',funnel:'Topo',metric:'CTR',value:pct(ctr),sample:counts.impressions>=3000&&counts.clicks>=80,issues:attentionIssues,level:counts.impressions<3000||counts.clicks<80?'insufficient':attentionIssues.length>=2?'critical':attentionIssues.length?'attention':'healthy'})

    const intentIssues=[]
    if(lowerBad(clickLpv,prevFunnel.click_to_lpv,10)) intentIssues.push(`clique→LPV caiu ${num(Math.abs(change(clickLpv,prevFunnel.click_to_lpv)),1)}%`)
    if(lowerBad(lpvCart,prevFunnel.lpv_to_cart,15)) intentIssues.push(`LPV→carrinho caiu ${num(Math.abs(change(lpvCart,prevFunnel.lpv_to_cart)),1)}%`)
    rows.push({key:'intent',name:'Intenção',funnel:'Meio',metric:'LPV → carrinho',value:pct(lpvCart),sample:counts.lpv>=80,issues:intentIssues,level:counts.lpv<80?'insufficient':intentIssues.length>=2?'critical':intentIssues.length?'attention':'healthy'})

    const conversionIssues=[]
    if(lowerBad(cartCheckout,prevFunnel.cart_to_checkout,15)) conversionIssues.push(`carrinho→checkout caiu ${num(Math.abs(change(cartCheckout,prevFunnel.cart_to_checkout)),1)}%`)
    if(lowerBad(checkoutPurchase,prevFunnel.checkout_to_purchase,15)) conversionIssues.push(`checkout→compra caiu ${num(Math.abs(change(checkoutPurchase,prevFunnel.checkout_to_purchase)),1)}%`)
    rows.push({key:'conversion',name:'Conversão',funnel:'Fundo',metric:'Checkout → compra',value:pct(checkoutPurchase),sample:counts.atc>=15&&counts.checkout>=8,issues:conversionIssues,level:counts.atc<15||counts.checkout<8?'insufficient':conversionIssues.length>=2?'critical':conversionIssues.length?'attention':'healthy'})

    const moneyIssues=[]
    if(maxCac&&cac>maxCac) moneyIssues.push(`CAC ${money(cac)} acima do limite ${money(maxCac)}`)
    if(minMer&&mer<minMer) moneyIssues.push(`MER ${num(mer)} abaixo do mínimo ${num(minMer)}`)
    if(lowerBad(conversion,prevConv,15)) moneyIssues.push(`conversão Shopify caiu ${num(Math.abs(change(conversion,prevConv)),1)}%`)
    rows.push({key:'monetization',name:'Monetização',funnel:'Negócio',metric:'MER',value:num(mer),sample:sessions>=150||orders>=8,issues:moneyIssues,level:sessions<150&&orders<8?'insufficient':moneyIssues.length>=2?'critical':moneyIssues.length?'attention':'healthy'})
    return rows
  },[funnel,prevFunnel,counts.impressions,counts.clicks,counts.lpv,counts.atc,counts.checkout,sessions,orders,cac,mer,maxCac,minMer,conversion,previous.conversion_rate])

  const primary=useMemo(()=>{
    const severity={critical:4,attention:3,insufficient:2,healthy:1}
    const critical=diagnostics.find(x=>x.level==='critical')
    if(critical) return critical
    const attention=diagnostics.find(x=>x.level==='attention')
    if(attention) return attention
    return diagnostics.slice().sort((a,b)=>severity[b.level]-severity[a.level])[0]
  },[diagnostics])

  const primaryContext=selectedContext==='auto'?stageFromDiagnostic(primary.key):selectedContext
  const relevantContexts=creativeContexts.filter(x=>x._stage===primaryContext)
  const relevantSets=setContexts.filter(x=>x._stage===primaryContext)
  const topSets=(relevantSets.length?relevantSets:relevantContexts).slice().sort((a,b)=>n(b.spend)-n(a.spend)).slice(0,5)
  const topCreativeContexts=relevantContexts.slice().sort((a,b)=>n(b.spend)-n(a.spend)).slice(0,6)
  const conceptMix=Object.values(relevantContexts.reduce((acc,row)=>{const k=row._concept||'product';if(!acc[k])acc[k]={key:k,count:0,spend:0,purchases:0};acc[k].count++;acc[k].spend+=n(row.spend);acc[k].purchases+=n(row.purchases);return acc},{})).sort((a,b)=>b.spend-a.spend)

  const winners=profiles.filter(x=>n(x?.metrics?.purchases)>=2&&n(x?.metrics?.roas)>=1).slice().sort((a,b)=>n(b.metrics?.spend)-n(a.metrics?.spend))
  const strategyReady=Boolean(maxCac||minMer||budget||revenueTarget)
  const primaryEntity=topSets[0]?.ad_set_name||topSets[0]?.name||topSets[0]?.set_name||stageLabel(primaryContext)
  const primaryCreative=topCreativeContexts[0]?`${topCreativeContexts[0]._creativeName} · ${conceptLabels[topCreativeContexts[0]._concept]||'Produto'}`:'criativos do estágio'

  const playbook=useMemo(()=>{
    const commonObserve=`Reavaliar quando houver mais amostra e comparar com o período anterior.`
    if(primary.level==='insufficient') return {
      command:'Não tomar decisão estrutural ainda. Ganhar amostra antes de mexer na conta.',
      why:'O estágio com maior incerteza ainda não tem volume suficiente para separar ruído de sinal.',
      doNow:{what:'Preservar entrega e ganhar amostra',where:stageLabel(primaryContext),why:'Alterações agora podem interromper aprendizado sem evidência suficiente.',priority:'Baixa',risk:'Baixo',validate:commonObserve},
      maintain:{what:winners[0]?`Manter ${cleanCreativeName(winners[0].name,'criativo')} como controle`:'Manter as estruturas atuais como controle',where:'Estruturas com melhor histórico',why:'Precisamos de referência estável para avaliar o próximo movimento.',priority:'Baixa',risk:'Baixo',validate:'Não deteriorar CAC, CTR e volume enquanto a amostra cresce.'},
      observe:{what:`Observar ${primary.metric}`,where:primary.name,why:'É o principal indicador ainda sem amostra confiável.',priority:'Baixa',risk:'Baixo',validate:commonObserve}
    }
    if(primary.key==='acquisition') return {
      command:'Não escalar orçamento ainda. Primeiro corrigir custo de aquisição de alcance.',
      why:primary.issues.join(' · ')||'Aquisição perdeu eficiência.',
      doNow:{what:'Investigar público, placement e concentração de verba',where:primaryEntity,why:'CPM/frequência indicam pressão antes mesmo do clique.',priority:'Alta',risk:'Médio',validate:'CPM estabilizar sem queda de CTR e sem aumento excessivo de frequência.'},
      maintain:{what:winners[0]?`Preservar ${cleanCreativeName(winners[0].name,'criativo')} como controle`:'Preservar o melhor criativo atual',where:'Topo',why:'Não trocar criativo e audiência ao mesmo tempo.',priority:'Média',risk:'Baixo',validate:'CTR e CPC permanecerem dentro do intervalo atual.'},
      observe:{what:'Observar frequência e CPM por conjunto',where:'Topo',why:'Precisamos separar saturação de leilão caro.',priority:'Média',risk:'Baixo',validate:'Comparar os conjuntos após nova janela de entrega.'}
    }
    if(primary.key==='attention') return {
      command:'Renovar atenção antes de aumentar verba.',
      why:primary.issues.join(' · ')||'A mensagem está perdendo força.',
      doNow:{what:'Criar 3 novas variações de hook mantendo um controle',where:primaryCreative,why:'A deterioração começa na atenção; trocar toda a estrutura esconderia a causa.',priority:'Alta',risk:'Baixo',validate:'CTR recuperar e CPC cair sem piorar LPV.'},
      maintain:{what:winners[0]?`Manter ${cleanCreativeName(winners[0].name,'criativo')} ativo`:'Manter o melhor criativo atual',where:'Topo',why:'Serve como controle do teste criativo.',priority:'Média',risk:'Baixo',validate:'Preservar compras e eficiência enquanto as novas peças ganham amostra.'},
      observe:{what:'Monitorar CTR, CPC e frequência juntos',where:'Topo',why:'Isso diferencia fadiga criativa de pressão de audiência.',priority:'Média',risk:'Baixo',validate:'Nova leitura após pelo menos 3.000 impressões por variante.'}
    }
    if(primary.key==='intent') return {
      command:'Não colocar mais tráfego no gargalo. Priorizar consideração e aderência anúncio → página.',
      why:primary.issues.join(' · ')||'A perda começa depois do clique.',
      doNow:{what:'Testar demonstração e prova social no Meio',where:primaryEntity,why:'O estágio perde intenção; novos hooks de Topo não corrigem LPV→carrinho.',priority:'Alta',risk:'Baixo',validate:'LPV→carrinho melhorar sem deteriorar CPC.'},
      maintain:{what:'Manter os criativos de Topo que ainda geram chegada qualificada',where:'Topo',why:'Aquisição não deve ser desmontada se o problema aparece depois.',priority:'Média',risk:'Baixo',validate:'Clique→LPV permanecer estável.'},
      observe:{what:'Auditar PDP mobile e coerência entre promessa e página',where:'Pós-clique',why:'Parte da perda pode estar na página e não na mídia.',priority:'Média',risk:'Baixo',validate:'Comparar LPV→carrinho por produto e mensagem.'}
    }
    if(primary.key==='conversion') return {
      command:'Parar de culpar aquisição. Corrigir fechamento antes de ampliar volume.',
      why:primary.issues.join(' · ')||'A perda acontece no fundo.',
      doNow:{what:'Investigar checkout, oferta e remarketing quente',where:primaryEntity,why:'Há intenção suficiente chegando ao fundo, mas menos usuários concluem.',priority:'Alta',risk:'Médio',validate:'Carrinho→checkout e checkout→compra recuperarem sem elevar CAC.'},
      maintain:{what:'Preservar Topo e Meio que continuam alimentando o funil',where:'Aquisição e consideração',why:'O problema foi localizado depois dessas etapas.',priority:'Média',risk:'Baixo',validate:'Volume de ATC permanecer estável.'},
      observe:{what:'Comparar frete, meios de pagamento e abandono',where:'Checkout',why:'Fricção comercial pode explicar a queda melhor do que mídia.',priority:'Média',risk:'Baixo',validate:'Taxa de checkout→compra e pedidos Shopify.'}
    }
    return {
      command:'Priorizar eficiência econômica antes de escalar mídia.',
      why:primary.issues.join(' · ')||'A operação precisa proteger monetização.',
      doNow:{what:'Ajustar escala aos guardrails de CAC e MER',where:'Conta',why:'Crescimento sem retorno sustentável piora o resultado do negócio.',priority:'Alta',risk:'Médio',validate:`CAC ≤ ${maxCac?money(maxCac):'limite definido'} e MER ≥ ${minMer?num(minMer):'mínimo definido'}.`},
      maintain:{what:'Preservar campanhas e criativos com compra eficiente',where:'Estruturas vencedoras',why:'Cortes amplos podem remover o que ainda sustenta receita.',priority:'Média',risk:'Baixo',validate:'Shopify receita/pedidos e CAC blended.'},
      observe:{what:'Separar queda de conversão de queda de ticket',where:'Shopify',why:'São problemas comerciais diferentes e exigem ações diferentes.',priority:'Média',risk:'Baixo',validate:'Conversão Shopify, ticket e receita por sessão.'}
    }
  },[primary,primaryContext,primaryEntity,primaryCreative,winners,maxCac,minMer])

  const contextOptions=[['auto','Gargalo'],['top','Topo'],['middle','Meio'],['bottom','Fundo'],['mixed','Misto']]

  return <div className="page deep-page manager-deep traffic-manager-v2">
    <PageHeader eyebrow="GESTOR" title="Centro de decisão de tráfego" description="O Gestor localiza o primeiro gargalo relevante, mostra quais contextos e mensagens estão envolvidos e transforma a leitura em ações que podem ser executadas e validadas." actions={<button className="btn primary" onClick={onRefresh}>Atualizar leitura</button>}/>

    <section className="tm-command">
      <div className="tm-command-main"><span>PRINCIPAL DECISÃO AGORA</span><h2>{playbook.command}</h2><p>{playbook.why}</p><div className="tm-command-meta"><Badge tone={tone(primary.level)}>{stateLabel(primary.level)}</Badge><strong>{primary.name}</strong><em>{primary.metric}: {primary.value}</em></div></div>
      <div className="tm-command-kpis"><Metric label="Receita" value={money(revenue)} note={revenueTarget?`meta ${money(revenueTarget)}`:'meta não definida'}/><Metric label="Investimento" value={money(spend)} note={budget?`orçamento ${money(budget)}`:'orçamento não definido'}/><Metric label="CAC" value={money(cac)} note={maxCac?`máx. ${money(maxCac)}`:'limite não definido'}/><Metric label="MER" value={num(mer)} note={minMer?`mín. ${num(minMer)}`:'mínimo não definido'}/></div>
    </section>

    {!strategyReady&&<div className="tm-warning"><strong>Guardrails econômicos incompletos.</strong><span>O Gestor pode localizar gargalos, mas não deve recomendar escala agressiva sem CAC máximo, MER mínimo, orçamento ou meta de receita.</span></div>}

    <SectionHeader number="01" eyebrow="FUNIL" title="Onde o problema começa" description="A leitura segue a cadeia causal. Topo, Meio e Fundo são o contexto estratégico; por dentro, o motor separa aquisição, atenção, intenção, conversão e monetização."/>
    <div className="tm-diagnostic-flow">{diagnostics.map((d,i)=><article key={d.key} className={`tm-diagnostic ${d.key===primary.key?'primary':''}`}><div><span>0{i+1} · {d.funnel.toUpperCase()}</span><Badge tone={tone(d.level)}>{stateLabel(d.level)}</Badge></div><h3>{d.name}</h3><strong>{d.value}</strong><small>{d.metric}</small><p>{d.issues[0]||'Sem deterioração material detectada nesta etapa.'}</p></article>)}</div>

    <section className="tm-causal"><div><span>CADEIA CAUSAL</span><h2>{primary.level==='healthy'?'Nenhum gargalo material detectado':`Primeiro ponto prioritário: ${primary.name}`}</h2><p>{primary.issues.length?primary.issues.join(' · '):'A leitura atual não mostra deterioração relevante; a prioridade passa a ser proteger o que funciona e testar sem desmontar controles.'}</p></div><div className="tm-causal-chain"><span>CPM</span><i>→</i><span>CTR</span><i>→</i><span>LPV</span><i>→</i><span>ATC</span><i>→</i><span>Checkout</span><i>→</i><span>Compra</span><i>→</i><span>CAC / MER</span></div></section>

    <SectionHeader number="02" eyebrow="DECISÃO" title="O que fazer, o que preservar e o que observar" description="O Gestor evita listas intermináveis. A prioridade é agir no gargalo dominante sem destruir estruturas que continuam saudáveis."/>
    <div className="tm-action-grid"><DecisionCard title="FAZER AGORA" item={playbook.doNow} toneName="do"/><DecisionCard title="MANTER" item={playbook.maintain} toneName="keep"/><DecisionCard title="OBSERVAR" item={playbook.observe} toneName="watch"/></div>

    <SectionHeader number="03" eyebrow="CONTEXTO DE MÍDIA" title="Onde essa decisão deve ser aplicada" description="Topo, Meio e Fundo vêm da campanha/conjunto/audiência. O criativo não define o estágio; ele é analisado dentro do contexto em que foi entregue."/>
    <div className="tm-context-tabs">{contextOptions.map(([k,l])=><button key={k} className={(selectedContext===k)?'active':''} onClick={()=>setSelectedContext(k)}>{l}</button>)}</div>
    <div className="tm-context-summary"><Metric label="Topo" value={integer(contextSummary.count.top)} note={money(contextSummary.spend.top)}/><Metric label="Meio" value={integer(contextSummary.count.middle)} note={money(contextSummary.spend.middle)}/><Metric label="Fundo" value={integer(contextSummary.count.bottom)} note={money(contextSummary.spend.bottom)}/><Metric label="Misto" value={integer(contextSummary.count.mixed)} note={money(contextSummary.spend.mixed)}/><Metric label="Não classificado" value={integer(contextSummary.count.unknown)} note={money(contextSummary.spend.unknown)}/></div>

    <div className="tm-context-grid">
      <Surface eyebrow={stageLabel(primaryContext).toUpperCase()} title="Conjuntos e contextos relevantes"><div className="tm-list">{topSets.length?topSets.map((row,i)=><div key={row._key||i}><span>{String(i+1).padStart(2,'0')}</span><p><strong>{safeName(row.ad_set_name||row.name||row.set_name)}</strong><small>{stageLabel(row._stage)} · confiança {integer(row._confidence)}% · gasto {money(row.spend)}</small></p></div>):<p className="muted-copy">Os dados atuais não expõem conjuntos suficientes para este estágio.</p>}</div></Surface>
      <Surface eyebrow="CRIATIVO × CONTEXTO" title="Mensagens usadas neste estágio"><div className="tm-list">{topCreativeContexts.length?topCreativeContexts.map((row,i)=><div key={row._key||i}><span>{String(i+1).padStart(2,'0')}</span><p><strong>{row._creativeName}</strong><small>{conceptLabels[row._concept]||'Produto'} · {roleLabels[row._role]||'—'} · {stageLabel(row._stage)} · gasto {money(row.spend)}</small></p></div>):<p className="muted-copy">Ainda não há cruzamento criativo × conjunto suficiente para este estágio.</p>}</div></Surface>
    </div>

    <SectionHeader number="04" eyebrow="MENSAGEM" title="Cobertura criativa do estágio" description="Aqui o Gestor verifica se a verba está dependente de poucos conceitos e se existe lacuna de mensagem para a etapa do funil selecionada."/>
    <div className="tm-concept-grid">{conceptMix.length?conceptMix.slice(0,6).map(x=><article key={x.key}><span>{conceptLabels[x.key]||x.key}</span><strong>{integer(x.count)}</strong><small>{money(x.spend)} · {integer(x.purchases)} compra(s)</small></article>):<article className="empty"><span>Sem classificação</span><p>Classifique conceitos nos criativos ou aguarde dados de contexto suficientes.</p></article>}</div>

    <SectionHeader number="05" eyebrow="CONTROLE" title="Como saber se a decisão funcionou" description="Toda ação precisa de um critério de validação. Se o indicador não responder, o Gestor deve abandonar a hipótese e investigar a próxima causa."/>
    <section className="tm-validation"><div><span>HIPÓTESE</span><strong>{playbook.doNow.what}</strong><p>{playbook.doNow.why}</p></div><div><span>CRITÉRIO</span><strong>{playbook.doNow.validate}</strong><p>Risco: {playbook.doNow.risk}. A decisão deve ser reavaliada com nova amostra, não apenas por uma compra isolada.</p></div></section>
  </div>
}
