import React, { useEffect, useMemo, useState } from 'react'
import { PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'

const STORAGE_KEY='skin_growth_strategy_v1'
const n=v=>Number(v||0)
const ratio=(a,b)=>n(b)?n(a)/n(b):0
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v))

const defaults={
  revenue_target:'', orders_target:'', media_budget:'', max_cac:'', min_mer:'',
  target_conversion:'', target_ticket:'', growth_target:'',
  acquisition_pct:70, retargeting_pct:20, testing_pct:10,
  primary_objective:'Crescer receita com eficiência', strategy_notes:''
}

function loadStrategy(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return defaults}
}

function Field({label,value,onChange,prefix,suffix,placeholder}){
  return <label className="strategy-field"><span>{label}</span><div>{prefix&&<em>{prefix}</em>}<input value={value} placeholder={placeholder||'—'} inputMode="decimal" onChange={e=>onChange(e.target.value)}/>{suffix&&<em>{suffix}</em>}</div></label>
}

function StatePill({state}){
  const map={healthy:['Saudável','good'],watch:['Atenção','watch'],bottleneck:['Gargalo','bad'],opportunity:['Oportunidade','opportunity'],insufficient:['Amostra insuficiente','neutral']}
  const [label,tone]=map[state]||map.insufficient
  return <span className={`strategy-state ${tone}`}>{label}</span>
}

function stageState(primary, previous, direction='higher', minimum=true){
  if(primary===null||primary===undefined||Number.isNaN(Number(primary))||(minimum&&n(primary)===0)) return 'insufficient'
  if(previous===null||previous===undefined||n(previous)===0) return 'watch'
  const delta=(n(primary)-n(previous))/Math.abs(n(previous))*100
  const signed=direction==='lower'?-delta:delta
  if(signed<=-18) return 'bottleneck'
  if(signed<=-8) return 'watch'
  if(signed>=12) return 'opportunity'
  return 'healthy'
}

function StageCard({stage,active,onClick}){
  return <button className={`strategy-stage-card ${active?'active':''}`} onClick={onClick}>
    <div className="strategy-stage-top"><span>{stage.index}</span><StatePill state={stage.state}/></div>
    <h3>{stage.name}</h3><p>{stage.objective}</p>
    <div className="strategy-stage-kpi"><small>{stage.metric}</small><strong>{stage.value}</strong></div>
    <em>{stage.signal}</em>
  </button>
}

function Readout({label,value,note}){return <div className="strategy-readout"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}

export default function StrategyPage({data,onGoManager}){
  const [strategy,setStrategy]=useState(loadStrategy)
  const [saved,setSaved]=useState(false)
  const [activeStage,setActiveStage]=useState('acquisition')

  const business=data?.shopify?.business||[]
  const funnels=data?.funnel?.months||[]
  const current=business.at?.(-1)||{}
  const previous=business.at?.(-2)||{}
  const fm=useMemo(()=>funnels.find(x=>x.month_start===current.month_start)||funnels.at?.(-1)||{},[funnels,current.month_start])
  const pf=useMemo(()=>funnels.find(x=>x.month_start===previous.month_start)||funnels.at?.(-2)||{},[funnels,previous.month_start])

  useEffect(()=>{setSaved(false)},[strategy])
  const change=(key,value)=>setStrategy(s=>({...s,[key]:value}))
  const save=()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(strategy));setSaved(true)}

  const revenue=n(current.shopify_revenue), orders=n(current.shopify_orders), spend=n(current.meta_spend), sessions=n(current.sessions)
  const ticket=orders?revenue/orders:0, cac=orders?spend/orders:0, cvr=n(current.conversion_rate)*100, mer=n(current.mer)
  const revenueTarget=n(strategy.revenue_target), budget=n(strategy.media_budget), maxCac=n(strategy.max_cac), minMer=n(strategy.min_mer)
  const targetOrders=n(strategy.orders_target), targetCvr=n(strategy.target_conversion), targetTicket=n(strategy.target_ticket)
  const remainingRevenue=Math.max(0,revenueTarget-revenue), remainingBudget=Math.max(0,budget-spend)
  const revenueProgress=revenueTarget?clamp(revenue/revenueTarget*100):0
  const budgetProgress=budget?clamp(spend/budget*100):0
  const cacHeadroom=maxCac?((maxCac-cac)/maxCac)*100:null

  const acquisitionState=stageState(fm.cpm,pf.cpm,'lower')
  const attentionState=stageState(fm.ctr,pf.ctr,'higher')
  const intentPrimary=n(fm.lpv_to_cart)||n(fm.click_to_lpv)
  const intentPrev=n(pf.lpv_to_cart)||n(pf.click_to_lpv)
  const intentState=stageState(intentPrimary,intentPrev,'higher')
  const conversionPrimary=n(fm.checkout_to_purchase)||n(current.conversion_rate)*100
  const conversionPrev=n(pf.checkout_to_purchase)||n(previous.conversion_rate)*100
  const conversionState=stageState(conversionPrimary,conversionPrev,'higher')
  let monetizationState=stageState(mer,n(previous.mer),'higher')
  if(minMer&&mer<minMer*.85) monetizationState='bottleneck'; else if(minMer&&mer<minMer) monetizationState='watch'; else if(minMer&&mer>=minMer) monetizationState='healthy'

  const stages=[
    {key:'acquisition',index:'01',name:'Aquisição',objective:'Comprar alcance suficiente sem pressionar excessivamente o custo de entrada.',metric:'CPM',value:money(fm.cpm),state:acquisitionState,signal:`Alcance ${integer(fm.reach)} · frequência ${num(fm.frequency)}`,metrics:[['Investimento',money(spend)],['CPM',money(fm.cpm)],['Alcance',integer(fm.reach)],['Frequência',num(fm.frequency)]],questions:['O custo para entrar no leilão está piorando?','Existe espaço de audiência para escalar?','A frequência indica saturação?'],actions:['Ampliar aquisição quando eficiência e frequência permitirem.','Investigar público/placement se CPM piorar sem deterioração criativa.']},
    {key:'attention',index:'02',name:'Atenção',objective:'Fazer a audiência parar, consumir a mensagem e gerar clique qualificado.',metric:'CTR',value:pct(fm.ctr),state:attentionState,signal:`CPC ${money(fm.cpc)} · ${integer(fm.link_clicks||fm.clicks)} cliques`,metrics:[['CTR',pct(fm.ctr)],['CPC',money(fm.cpc)],['Cliques',integer(fm.link_clicks||fm.clicks)],['Frequência',num(fm.frequency)]],questions:['Os criativos ainda chamam atenção?','A queda de eficiência começa antes do clique?','Existe dependência de poucas peças?'],actions:['Renovar hooks e conceitos quando CTR deteriorar.','Proteger peças vencedoras enquanto novos conceitos ganham amostra.']},
    {key:'intent',index:'03',name:'Intenção',objective:'Transformar atenção em interesse comercial real depois do clique.',metric:'LPV → carrinho',value:pct(fm.lpv_to_cart),state:intentState,signal:`Clique→LPV ${pct(fm.click_to_lpv)} · ${integer(fm.adds_to_cart)} carrinhos`,metrics:[['Clique → LPV',pct(fm.click_to_lpv)],['LPV → carrinho',pct(fm.lpv_to_cart)],['LPVs',integer(fm.landing_page_views)],['Carrinhos',integer(fm.adds_to_cart)]],questions:['O clique realmente chega à página?','A promessa do anúncio combina com a landing?','Quem chega demonstra intenção de compra?'],actions:['Separar problema de tráfego de problema de mensagem/página.','Priorizar prova, demonstração e benefício quando a intenção estiver fraca.']},
    {key:'conversion',index:'04',name:'Conversão',objective:'Transformar intenção em checkout e compra sem perder eficiência no fundo.',metric:'Checkout → compra',value:pct(fm.checkout_to_purchase),state:conversionState,signal:`Carrinho→checkout ${pct(fm.cart_to_checkout)} · CAC ${money(cac)}`,metrics:[['Carrinho → checkout',pct(fm.cart_to_checkout)],['Checkout → compra',pct(fm.checkout_to_purchase)],['Compras',integer(orders)],['CAC blended',money(cac)]],questions:['Quem adiciona ao carrinho avança?','O checkout está segurando vendas?','Remarketing recebe volume suficiente para funcionar?'],actions:['Não mexer no fundo se ele estiver saudável e o gargalo estiver antes.','Investigar oferta, checkout e remarketing quando a perda começar aqui.']},
    {key:'monetization',index:'05',name:'Monetização',objective:'Garantir que crescimento de mídia gere receita economicamente sustentável.',metric:'MER',value:num(mer),state:monetizationState,signal:`Receita ${money(revenue)} · ticket ${money(ticket)}`,metrics:[['Receita',money(revenue)],['MER',num(mer)],['Ticket',money(ticket)],['Conversão Shopify',pct(cvr)]],questions:['A venda paga o custo de aquisição?','A receita cresce na mesma direção do investimento?','O site monetiza bem cada sessão?'],actions:['Escalar apenas quando economia e capacidade do funil sustentarem.','Usar Shopify como verdade comercial e Meta como atribuição de mídia.']},
  ]

  const active=stages.find(x=>x.key===activeStage)||stages[0]
  const severity={bottleneck:5,watch:4,insufficient:3,opportunity:2,healthy:1}
  const bottleneck=stages.slice().sort((a,b)=>severity[b.state]-severity[a.state])[0]
  const targetConfigured=Boolean(revenueTarget||budget||maxCac||minMer||targetOrders||targetCvr||targetTicket)
  const allocationTotal=n(strategy.acquisition_pct)+n(strategy.retargeting_pct)+n(strategy.testing_pct)

  return <div className="page strategy-page">
    <PageHeader eyebrow="ESTRATÉGIA" title="Sistema de crescimento" description="Define as regras do jogo antes de analisar a conta. Metas humanas, economia e prioridades orientam o Gestor; os dados mostram onde a estratégia está funcionando ou travando." actions={<button className="btn primary" onClick={save}>{saved?'Estratégia salva':'Salvar estratégia'}</button>}/>

    <section className="strategy-origin-grid">
      <article className="strategy-origin human"><span>DEFINIDO PELA EMPRESA</span><h2>Objetivo e limites</h2><p>Receita, orçamento, CAC aceitável e prioridades não devem ser inventados pela IA.</p></article>
      <article className="strategy-origin system"><span>CALCULADO PELO SISTEMA</span><h2>Estado e decisão</h2><p>Performance, gargalo, tendência, oportunidade e recomendação são calculados a partir de Meta + Shopify.</p></article>
    </section>

    <SectionHeader number="01" eyebrow="NORTE" title="Objetivo econômico da operação" description="A IA só consegue tomar boas decisões quando sabe qual resultado o negócio considera sustentável."/>
    <div className="strategy-goal-layout">
      <Surface eyebrow="META DO NEGÓCIO" title="O que queremos entregar"><div className="strategy-form-grid"><Field label="Receita alvo" prefix="R$" value={strategy.revenue_target} onChange={v=>change('revenue_target',v)}/><Field label="Pedidos alvo" value={strategy.orders_target} onChange={v=>change('orders_target',v)}/><Field label="Orçamento de mídia" prefix="R$" value={strategy.media_budget} onChange={v=>change('media_budget',v)}/><Field label="Crescimento desejado" suffix="%" value={strategy.growth_target} onChange={v=>change('growth_target',v)}/></div><label className="strategy-text-field"><span>Objetivo principal</span><input value={strategy.primary_objective} onChange={e=>change('primary_objective',e.target.value)}/></label></Surface>
      <Surface eyebrow="GUARDRAILS" title="Até onde podemos ir"><div className="strategy-form-grid"><Field label="CAC máximo" prefix="R$" value={strategy.max_cac} onChange={v=>change('max_cac',v)}/><Field label="MER mínimo" value={strategy.min_mer} onChange={v=>change('min_mer',v)}/><Field label="Conversão mínima" suffix="%" value={strategy.target_conversion} onChange={v=>change('target_conversion',v)}/><Field label="Ticket esperado" prefix="R$" value={strategy.target_ticket} onChange={v=>change('target_ticket',v)}/></div><label className="strategy-text-field"><span>Contexto / restrições</span><input value={strategy.strategy_notes} placeholder="Ex.: lançamento, estoque, promoção, limite de margem..." onChange={e=>change('strategy_notes',e.target.value)}/></label></Surface>
    </div>

    <div className="strategy-progress-grid">
      <Readout label="Receita atual" value={money(revenue)} note={revenueTarget?`${num(revenueProgress,1)}% da meta`:'Defina uma meta de receita'}/>
      <Readout label="Falta para a meta" value={revenueTarget?money(remainingRevenue):'—'} note={targetOrders?`${Math.max(0,targetOrders-orders)} pedidos restantes`:''}/>
      <Readout label="Investimento" value={money(spend)} note={budget?`${num(budgetProgress,1)}% do orçamento`:'Defina orçamento'}/>
      <Readout label="Orçamento restante" value={budget?money(remainingBudget):'—'}/>
      <Readout label="CAC atual" value={money(cac)} note={cacHeadroom===null?'Defina CAC máximo':cacHeadroom>=0?`${num(cacHeadroom,1)}% de folga`:`${num(Math.abs(cacHeadroom),1)}% acima do limite`}/>
      <Readout label="MER atual" value={num(mer)} note={minMer?`mínimo ${num(minMer)}`:'Defina MER mínimo'}/>
    </div>

    {!targetConfigured&&<div className="strategy-warning"><strong>A estratégia econômica ainda não está configurada.</strong><span>O sistema consegue ler o funil, mas não deve concluir capacidade de escala ou eficiência econômica sem metas definidas pela empresa.</span></div>}

    <SectionHeader number="02" eyebrow="MAPA DE CRESCIMENTO" title="Onde o crescimento está sendo limitado" description="As etapas são diagnósticas, não campanhas rígidas. O objetivo é localizar onde a deterioração começa antes de decidir o que alterar."/>
    <div className="strategy-stage-flow">{stages.map(s=><StageCard key={s.key} stage={s} active={activeStage===s.key} onClick={()=>setActiveStage(s.key)}/>)}</div>

    <section className="strategy-stage-detail">
      <div className="strategy-stage-copy"><div><span>{active.index} · {active.name.toUpperCase()}</span><StatePill state={active.state}/></div><h2>{active.objective}</h2><p>O sistema lê esta etapa a partir dos dados observados e compara, quando possível, com o período anterior. Metas específicas por estágio serão a próxima camada persistente da Estratégia.</p><div className="strategy-question-list">{active.questions.map((q,i)=><p key={i}><span>0{i+1}</span>{q}</p>)}</div></div>
      <div className="strategy-stage-side"><div className="strategy-stage-metrics">{active.metrics.map(([l,v])=><Readout key={l} label={l} value={v}/>)}</div><div className="strategy-actions"><span>LINHA DE AÇÃO</span>{active.actions.map((x,i)=><p key={i}>→ {x}</p>)}</div></div>
    </section>

    <SectionHeader number="03" eyebrow="ALOCACÃO" title="Como queremos usar a verba" description="A distribuição é um plano humano. O Gestor poderá recomendar mudanças, mas não deve assumir percentuais sem contexto econômico e estratégico."/>
    <div className="strategy-allocation-layout">
      <Surface eyebrow="PLANO DE VERBA" title="Distribuição desejada"><div className="strategy-allocation-fields"><Field label="Aquisição" suffix="%" value={strategy.acquisition_pct} onChange={v=>change('acquisition_pct',v)}/><Field label="Retargeting" suffix="%" value={strategy.retargeting_pct} onChange={v=>change('retargeting_pct',v)}/><Field label="Testes" suffix="%" value={strategy.testing_pct} onChange={v=>change('testing_pct',v)}/></div><div className={`strategy-allocation-total ${allocationTotal===100?'ok':'bad'}`}>Total <strong>{num(allocationTotal,0)}%</strong><span>{allocationTotal===100?'Distribuição consistente':'Os percentuais precisam somar 100%'}</span></div></Surface>
      <Surface eyebrow="REGRA DO GESTOR" title="A verba segue o gargalo"><div className="strategy-principles"><p><strong>Não aumentar aquisição</strong><span>se intenção ou conversão não suportarem mais volume.</span></p><p><strong>Não aumentar remarketing</strong><span>apenas porque o ROAS parece alto com pouca escala.</span></p><p><strong>Preservar verba de testes</strong><span>para renovar criativos e evitar dependência dos vencedores atuais.</span></p></div></Surface>
    </div>

    <SectionHeader number="04" eyebrow="PRIORIDADE" title="O que o Gestor deve resolver primeiro" description="O sistema concentra a decisão no limitante dominante em vez de produzir uma lista infinita de alertas."/>
    <section className="strategy-priority">
      <div><span>GARGALO / PONTO DE ATENÇÃO DOMINANTE</span><h2>{bottleneck.name}</h2><StatePill state={bottleneck.state}/><p>{bottleneck.objective}</p></div>
      <div className="strategy-priority-actions"><article><span>PROTEGER</span><strong>O que já funciona</strong><p>Evitar alterações simultâneas nas etapas saudáveis enquanto investigamos o gargalo.</p></article><article><span>TESTAR</span><strong>Uma hipótese por vez</strong><p>Transformar recomendação em teste com KPI principal, guardrail e janela mínima.</p></article><article><span>INVESTIGAR</span><strong>Causa antes da ação</strong><p>Descer para Criativos, Públicos, Placements ou Pós-clique somente quando a evidência apontar essa direção.</p></article></div>
      <button className="btn primary" onClick={onGoManager}>Abrir Gestor com esta estratégia</button>
    </section>

    <SectionHeader number="05" eyebrow="CICLO" title="Como os módulos se conectam" description="A Estratégia não é uma página isolada. Ela define o contexto que deve governar o restante do produto."/>
    <div className="strategy-cycle"><div><span>01</span><strong>Estratégia</strong><p>Define objetivo e limites.</p></div><i>→</i><div><span>02</span><strong>Gestor</strong><p>Localiza gargalo e decide.</p></div><i>→</i><div><span>03</span><strong>Análise</strong><p>Explica a causa.</p></div><i>→</i><div><span>04</span><strong>Execução</strong><p>Transforma em ação/teste.</p></div><i>→</i><div><span>05</span><strong>Aprendizado</strong><p>Retroalimenta a estratégia.</p></div></div>
  </div>
}
