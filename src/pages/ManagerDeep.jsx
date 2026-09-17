import React, { useMemo, useState } from 'react'
import { ChartCard, HorizontalBars } from '../components/Charts.jsx'
import { Badge, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { cleanCreativeName, delta, integer, money, num, pct, priorityRank } from '../lib/format.js'

const n=v=>Number(v||0)
const arr=v=>Array.isArray(v)?v:[]
const text=(value,fallback='—')=>{
  if(value===null||value===undefined||value==='') return fallback
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean') return String(value)
  if(Array.isArray(value)) return value.map(v=>text(v,'')).filter(Boolean).join(' · ')||fallback
  if(typeof value==='object'){
    const preferred=value.title||value.label||value.action||value.description||value.summary||value.text||value.detail||value.reason||value.name
    if(preferred) return text(preferred,fallback)
    return Object.entries(value).map(([k,v])=>`${k}: ${text(v,'')}`).filter(x=>!x.endsWith(': ')).join(' · ')||fallback
  }
  return fallback
}
const change=(a,b)=>delta(n(a),n(b))
const falling=(a,b,threshold=10)=>{const d=change(a,b);return d!==null&&d<=-threshold}
const rising=(a,b,threshold=10)=>{const d=change(a,b);return d!==null&&d>=threshold}

function toneFrom(level){return level==='critical'?'danger':level==='attention'?'warning':level==='healthy'?'success':'neutral'}
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}

function StageCard({stage,active,onClick}){
  return <button className={`funnel-strategy-card ${active?'active':''}`} onClick={onClick}>
    <div className="funnel-strategy-head"><span>{stage.eyebrow}</span><Badge tone={toneFrom(stage.level)}>{stage.status}</Badge></div>
    <h3>{stage.title}</h3>
    <div className="funnel-strategy-kpi"><strong>{stage.heroValue}</strong><small>{stage.heroLabel}</small></div>
    <p>{stage.summary}</p>
    <div className="funnel-strategy-action"><span>PRÓXIMA LEITURA</span><strong>{stage.next}</strong></div>
  </button>
}

function StageDetail({stage}){
  return <section className="strategy-detail-panel">
    <div className="strategy-detail-copy"><span>{stage.eyebrow}</span><h2>{stage.title}</h2><p>{stage.long}</p><div className="strategy-decision"><small>DECISÃO DO GESTOR</small><strong>{stage.decision}</strong></div></div>
    <div className="strategy-metric-list">{stage.metrics.map((m,i)=><div key={i}><span>{m.label}</span><strong>{m.value}</strong><small>{m.note}</small></div>)}</div>
    <div className="strategy-actions-list"><span>O QUE FAZER AGORA</span>{stage.actions.map((x,i)=><div key={i}><b>{String(i+1).padStart(2,'0')}</b><p>{x}</p></div>)}</div>
  </section>
}

export default function ManagerDeep({data,onOpen,onRefresh}){
  const manager=data?.manager||{}, perf=data?.bootstrap?.performance||{}, deep=data?.deep||{}, business=arr(data?.shopify?.business), funnelMonths=arr(data?.funnel?.months)
  const current=business.at(-1)||{}, previous=business.length>1?business.at(-2):{}
  const funnel=funnelMonths.find(x=>x.month_start===current.month_start)||funnelMonths.at(-1)||{}
  const prevFunnel=funnelMonths.length>1?funnelMonths.at(-2)||{}:{}
  const benchmark=n(deep?.benchmarks?.avg_ctr)
  const decisions=arr(manager.decisions).filter(x=>x?.model==='traffic-manager-v3').sort((a,b)=>priorityRank(b?.recommended_action?.priority||b?.severity)-priorityRank(a?.recommended_action?.priority||a?.severity))
  const open=decisions.filter(x=>x?.status==='open'), topDecision=open[0]||decisions[0], action=(topDecision?.recommended_action&&typeof topDecision.recommended_action==='object')?topDecision.recommended_action:{}
  const experiments=arr(manager.experiments), observations=arr(manager.observations)
  const profiles=arr(deep?.creative_profiles)
  const waste=deep?.waste||{}, wasteItems=arr(waste?.items)
  const daily=arr(perf?.daily), labels=daily.map(x=>String(x?.date||'').slice(5))
  const [activeStage,setActiveStage]=useState('top')

  const revenue=n(current.shopify_revenue), orders=n(current.shopify_orders), spend=n(current.meta_spend), sessions=n(current.sessions)
  const conversion=n(current.conversion_rate)*100, ticket=orders?revenue/orders:0, cac=orders?spend/orders:0, revenuePerSession=sessions?revenue/sessions:0
  const winners=profiles.filter(x=>n(x?.metrics?.purchases)>=2&&n(x?.metrics?.roas)>=1)
  const tired=profiles.filter(x=>n(x?.metrics?.spend)>=60&&n(x?.metrics?.purchases)===0)

  const stages=useMemo(()=>{
    const ctr=n(funnel.ctr), cpm=n(funnel.cpm), cpc=n(funnel.cpc), freq=n(funnel.frequency)
    const clickLpv=n(funnel.click_to_lpv), lpvCart=n(funnel.lpv_to_cart), cartCheckout=n(funnel.cart_to_checkout), checkoutPurchase=n(funnel.checkout_to_purchase)

    const topProblems=[]
    if(benchmark&&ctr<benchmark*.85) topProblems.push('CTR abaixo do benchmark da própria conta')
    if(rising(cpm,prevFunnel.cpm,15)) topProblems.push('CPM acelerou versus o período anterior')
    if(rising(freq,prevFunnel.frequency,15)) topProblems.push('frequência está subindo e pode indicar saturação')
    const topLevel=topProblems.length>=2?'critical':topProblems.length?'attention':'healthy'

    const midProblems=[]
    if(falling(clickLpv,prevFunnel.click_to_lpv,10)) midProblems.push('menos cliques estão virando visita real')
    if(falling(lpvCart,prevFunnel.lpv_to_cart,10)) midProblems.push('menos visitantes estão demonstrando intenção de compra')
    const midLevel=midProblems.length>=2?'critical':midProblems.length?'attention':'healthy'

    const bottomProblems=[]
    if(falling(cartCheckout,prevFunnel.cart_to_checkout,10)) bottomProblems.push('o carrinho está avançando menos para checkout')
    if(falling(checkoutPurchase,prevFunnel.checkout_to_purchase,10)) bottomProblems.push('o checkout está fechando menos compras')
    if(falling(current.meta_roas,previous.meta_roas,15)) bottomProblems.push('o retorno atribuído pela Meta perdeu eficiência')
    const bottomLevel=bottomProblems.length>=2?'critical':bottomProblems.length?'attention':'healthy'

    const postProblems=[]
    if(falling(current.conversion_rate,previous.conversion_rate,10)) postProblems.push('a conversão real do site caiu')
    if(falling(revenuePerSession,n(previous.sessions)?n(previous.shopify_revenue)/n(previous.sessions):0,10)) postProblems.push('cada sessão está gerando menos receita')
    const postLevel=postProblems.length>=2?'critical':postProblems.length?'attention':'healthy'

    return [
      {key:'top',eyebrow:'TOPO DO FUNIL',title:'Aquisição e atenção',level:topLevel,status:topLevel==='healthy'?'Saudável':topLevel==='critical'?'Prioridade alta':'Atenção',heroValue:pct(ctr),heroLabel:'CTR',summary:topProblems[0]||'A mídia está conseguindo gerar atenção sem sinal forte de deterioração comparativa.',next:topProblems[0]||'Proteger criativos que sustentam atenção',long:'Aqui o gestor avalia se estamos comprando atenção com eficiência e se a conta tem repertório criativo suficiente para continuar adquirindo tráfego sem saturar.',decision:topProblems.length?`Atacar aquisição antes de mexer no fundo: ${topProblems.join('; ')}.`:'Preservar a estrutura que está gerando atenção e ampliar aprendizado criativo sem mudanças bruscas.',metrics:[{label:'CPM',value:money(cpm),note:'custo de 1.000 impressões'},{label:'CPC',value:money(cpc),note:'custo do clique'},{label:'Frequência',value:num(freq),note:'pressão de repetição'},{label:'Criativos vencedores',value:integer(winners.length),note:'peças com compra + eficiência'}],actions:topProblems.length?[benchmark&&ctr<benchmark*.85?'Criar uma nova rodada de hooks, primeiros frames e propostas visuais usando os conceitos dos melhores criativos atuais.':null,rising(freq,prevFunnel.frequency,15)?'Renovar peças e revisar concentração de verba para reduzir dependência dos mesmos anúncios.':null,rising(cpm,prevFunnel.cpm,15)?'Investigar CPM por público e placement antes de ampliar orçamento.':null].filter(Boolean):['Mapear os conceitos dos vencedores e produzir variações controladas.','Manter pelo menos uma peça de controle enquanto novas criativas entram em teste.','Acompanhar frequência e CPM para detectar saturação antes da queda de CTR.']},
      {key:'middle',eyebrow:'MEIO DO FUNIL',title:'Consideração e intenção',level:midLevel,status:midLevel==='healthy'?'Saudável':midLevel==='critical'?'Prioridade alta':'Atenção',heroValue:pct(lpvCart),heroLabel:'LPV → carrinho',summary:midProblems[0]||'O tráfego que chega ao site está mantendo intenção de compra em relação ao período anterior.',next:midProblems[0]||'Aumentar intenção sem encarecer aquisição',long:'O meio do funil separa curiosidade de intenção. A pergunta não é apenas se houve clique, mas se a pessoa chegou de verdade, entendeu a proposta e avançou para uma ação de compra.',decision:midProblems.length?`A perda está entre clique e intenção: ${midProblems.join('; ')}.`:'Não há sinal comparativo forte de deterioração no meio; priorize testes que aumentem intenção sem sacrificar volume.',metrics:[{label:'Clique → LPV',value:pct(clickLpv),note:'qualidade da chegada'},{label:'LPV → carrinho',value:pct(lpvCart),note:'intenção de compra'},{label:'Landing page views',value:integer(funnel.landing_page_views),note:'visitas atribuídas'},{label:'Carrinhos',value:integer(funnel.adds_to_cart),note:'sinal de consideração'}],actions:[falling(clickLpv,prevFunnel.click_to_lpv,10)?'Auditar velocidade, carregamento e coerência entre promessa do anúncio e primeira dobra da página.':'Preservar as combinações anúncio → landing que mantêm boa chegada.',falling(lpvCart,prevFunnel.lpv_to_cart,10)?'Testar prova social, benefício, diferenciação, oferta e clareza de produto antes de trocar público.':'Criar criativos de consideração que aprofundem benefício, prova e mecanismo do produto.','Separar peças de curiosidade das peças que realmente geram intenção para não otimizar apenas por CTR.']},
      {key:'bottom',eyebrow:'FUNDO DO FUNIL',title:'Conversão e fechamento',level:bottomLevel,status:bottomLevel==='healthy'?'Saudável':bottomLevel==='critical'?'Prioridade alta':'Atenção',heroValue:pct(checkoutPurchase),heroLabel:'Checkout → compra',summary:bottomProblems[0]||'As etapas finais não mostram deterioração comparativa relevante no momento.',next:bottomProblems[0]||'Proteger eficiência de fechamento',long:'No fundo, o gestor precisa saber se a demanda criada está sendo convertida. É onde remarketing, oferta, condições comerciais e fricções de checkout passam a pesar mais.',decision:bottomProblems.length?`Não escalar aquisição sem revisar fechamento: ${bottomProblems.join('; ')}.`:'O fundo está preservado; evite desmontar estruturas de remarketing eficientes enquanto investiga etapas anteriores.',metrics:[{label:'Carrinho → checkout',value:pct(cartCheckout),note:'progressão comercial'},{label:'Checkout → compra',value:pct(checkoutPurchase),note:'fechamento'},{label:'ROAS Meta',value:num(current.meta_roas),note:'atribuição de mídia'},{label:'CAC real',value:money(cac),note:'mídia / pedidos Shopify'}],actions:[falling(cartCheckout,prevFunnel.cart_to_checkout,10)?'Revisar frete, surpresa de preço, condições e fricção entre carrinho e checkout.':'Manter o fluxo de carrinho que não apresenta queda relevante.',falling(checkoutPurchase,prevFunnel.checkout_to_purchase,10)?'Revisar meios de pagamento, confiança, erros e abandono no checkout.':'Preservar remarketing de fundo enquanto a taxa de fechamento estiver estável.','Usar criativos de fundo com prova, objeções, oferta e urgência — não repetir o mesmo criativo de aquisição.']},
      {key:'post',eyebrow:'PÓS-CLIQUE',title:'Site, oferta e monetização',level:postLevel,status:postLevel==='healthy'?'Saudável':postLevel==='critical'?'Prioridade alta':'Atenção',heroValue:pct(conversion),heroLabel:'Conversão Shopify',summary:postProblems[0]||'A monetização real por sessão não apresenta deterioração comparativa forte.',next:postProblems[0]||'Aumentar receita por sessão',long:'Esta camada impede que o gestor culpe a mídia por tudo. Shopify é a verdade comercial: aqui medimos se a sessão gerada pela mídia realmente vira receita, pedido e valor.',decision:postProblems.length?`Existe perda depois do clique e ela precisa ser tratada como problema comercial/site: ${postProblems.join('; ')}.`:'A camada comercial está preservada; a estratégia pode focar crescimento sem necessidade de uma intervenção ampla no site.',metrics:[{label:'Conversão Shopify',value:pct(conversion),note:'pedido / sessão'},{label:'Receita / sessão',value:money(revenuePerSession),note:'monetização do tráfego'},{label:'Ticket médio',value:money(ticket),note:'valor por pedido'},{label:'MER',value:num(current.mer),note:'receita real / mídia'}],actions:[falling(current.conversion_rate,previous.conversion_rate,10)?'Investigar produto, página, oferta, preço e checkout antes de aumentar pressão de mídia.':'Manter a experiência que está sustentando conversão.',falling(revenuePerSession,n(previous.sessions)?n(previous.shopify_revenue)/n(previous.sessions):0,10)?'Separar queda de ticket de queda de conversão para saber se o problema é monetização ou fechamento.':'Acompanhar receita por sessão junto com CAC para decidir escala.','Sempre confrontar atribuição Meta com pedidos e receita reais da Shopify.']}
    ]
  },[funnel,prevFunnel,current,previous,benchmark,winners.length,conversion,revenuePerSession,ticket,cac])

  const selectedStage=stages.find(x=>x.key===activeStage)||stages[0]
  const priorities=stages.slice().sort((a,b)=>({critical:3,attention:2,healthy:1}[b.level]-{critical:3,attention:2,healthy:1}[a.level]))
  const primary=priorities[0]

  return <div className="page deep-page manager-deep strategy-manager">
    <PageHeader eyebrow="GESTOR IA" title="Gestão estratégica de tráfego" description="A conta é lida como um sistema: aquisição, consideração, conversão e pós-clique. O objetivo não é apontar métricas ruins, mas decidir onde agir, o que preservar e qual teste vem depois." actions={<button className="btn primary" onClick={onRefresh}>Atualizar leitura</button>} />

    <section className="strategy-command">
      <div><span>PRIORIDADE DE GESTÃO</span><h2>{primary.title}</h2><p>{primary.decision}</p><div className="strategy-command-meta"><div><small>Receita</small><strong>{money(revenue)}</strong></div><div><small>Investimento</small><strong>{money(spend)}</strong></div><div><small>MER</small><strong>{num(current.mer)}</strong></div><div><small>CAC real</small><strong>{money(cac)}</strong></div></div></div>
      <aside><span>PLANO IMEDIATO</span><strong>{primary.actions[0]}</strong><p>Depois de agir, compare a mesma etapa do funil antes de escalar qualquer mudança para a conta inteira.</p>{topDecision&&<button className="btn light" onClick={()=>onOpen?.(topDecision.id)}>Abrir diagnóstico atual</button>}</aside>
    </section>

    <SectionHeader number="01" eyebrow="MAPA ESTRATÉGICO" title="Como está cada parte do funil" description="Clique em uma etapa para abrir a leitura de gestão. O status considera principalmente a mudança contra o período anterior e benchmarks da própria conta."/>
    <div className="funnel-strategy-grid">{stages.map(stage=><StageCard key={stage.key} stage={stage} active={activeStage===stage.key} onClick={()=>setActiveStage(stage.key)}/>)}</div>
    <StageDetail stage={selectedStage}/>

    <SectionHeader number="02" eyebrow="TRÁFEGO" title="Aquisição versus qualidade pós-clique" description="O gestor precisa separar mídia cara, mídia pouco atraente e tráfego que clica mas não progride."/>
    <div className="deep-two"><ChartCard title="CTR × LPV rate" subtitle="Atenção e qualidade da chegada" labels={labels} datasets={[{label:'CTR',data:daily.map(x=>n(x?.link_ctr||x?.ctr)),borderColor:'#48205d',backgroundColor:'rgba(72,32,93,.08)',fill:true,borderWidth:2.5,tension:.35,pointRadius:1.5},{label:'LPV rate',data:daily.map(x=>n(x?.lpv_rate)),borderColor:'#a786af',borderWidth:2,tension:.35,pointRadius:1.5}]} height={310}/><Surface eyebrow="LEITURA DE GESTÃO" title="Perguntas que a IA precisa responder"><div className="strategy-question-list"><p><b>01</b><span><strong>Estamos comprando atenção?</strong> CTR, CPM, CPC, frequência e fadiga criativa.</span></p><p><b>02</b><span><strong>O clique é qualificado?</strong> Clique→LPV e progressão até carrinho.</span></p><p><b>03</b><span><strong>A intenção fecha?</strong> Carrinho→checkout→compra, CAC e ROAS.</span></p><p><b>04</b><span><strong>O problema é mídia ou negócio?</strong> Shopify valida conversão, pedidos, ticket e receita por sessão.</span></p></div></Surface></div>

    <SectionHeader number="03" eyebrow="CRIATIVOS" title="Estratégia criativa, não só ranking de anúncios" description="O papel do gestor é proteger conceitos vencedores, renovar fadiga e criar testes que respondam perguntas específicas do funil."/>
    <div className="strategy-creative-grid"><Surface eyebrow="PROTEGER" title="Sinais vencedores"><div className="strategy-name-list">{winners.slice(0,5).map((x,i)=><div key={x.id||i}><span>{String(i+1).padStart(2,'0')}</span><strong>{cleanCreativeName(x.name,'Criativo')}</strong><small>ROAS {num(x.metrics?.roas)} · CTR {pct(x.metrics?.ctr)}</small></div>)}{!winners.length&&<p className="muted-copy">Ainda não há criativos com sinal forte de vencedor pela regra atual.</p>}</div></Surface><Surface eyebrow="RENOVAR" title="Peças que consumiram verba sem compra"><div className="strategy-name-list">{tired.slice(0,5).map((x,i)=><div key={x.id||i}><span>{String(i+1).padStart(2,'0')}</span><strong>{cleanCreativeName(x.name,'Criativo')}</strong><small>{money(x.metrics?.spend)} investidos · CTR {pct(x.metrics?.ctr)}</small></div>)}{!tired.length&&<p className="muted-copy">Nenhuma peça com sinal forte de desgaste nessa regra.</p>}</div></Surface><Surface eyebrow="PRÓXIMO TESTE" title="O que produzir"><div className="strategy-test-callout"><strong>{primary.key==='top'?'Novos hooks e ângulos de aquisição':primary.key==='middle'?'Criativos de consideração e prova':primary.key==='bottom'?'Criativos de objeção, oferta e fechamento':'Teste de mensagem alinhada à landing'}</strong><p>O teste deve responder ao gargalo prioritário do funil, não simplesmente adicionar mais uma peça à conta.</p></div></Surface></div>

    <SectionHeader number="04" eyebrow="EXECUÇÃO" title="O que proteger, testar e investigar" description="Transforma diagnóstico em uma agenda operacional clara para o gestor humano."/>
    <div className="strategy-execution-grid"><Surface eyebrow="PROTEGER" title="Não mexer sem evidência"><div className="deep-checks"><p>✓ Criativos e combinações que sustentam compra e eficiência.</p><p>✓ Remarketing de fundo quando fechamento continua saudável.</p><p>✓ Controle comparável durante qualquer teste novo.</p></div></Surface><Surface eyebrow="TESTAR" title="Fila estratégica"><div className="deep-checks">{primary.actions.slice(0,3).map((x,i)=><p key={i}>→ {x}</p>)}{experiments.slice(0,2).map((x,i)=><p key={`e${i}`}>→ {text(x?.title||x?.hypothesis||x?.description,'Experimento em andamento')}</p>)}</div></Surface><Surface eyebrow="INVESTIGAR" title="Riscos antes de cortar verba"><div className="deep-checks"><p>→ Exposição potencial: {money(waste?.summary?.estimated_total)}</p><p>→ {integer(wasteItems.length)} sinais classificados pelo motor.</p><p>→ Validar sempre criativo × público × placement antes de concluir causa.</p></div></Surface></div>

    <SectionHeader number="05" eyebrow="MEMÓRIA" title="Testes, decisões e aprendizado" description="Um gestor de IA só melhora quando mantém histórico do que foi observado, testado, aprovado e medido."/>
    <div className="deep-two"><Surface eyebrow="EXPERIMENTOS" title="O que está sendo testado"><div className="observation-list">{experiments.slice(0,6).map((x,i)=><div key={x?.id||i}><span>{text(x?.status,'teste')}</span><p>{text(x?.title||x?.hypothesis||x?.description,'Experimento registrado.')}</p></div>)}{!experiments.length&&<p className="muted-copy">Nenhum experimento estruturado em andamento.</p>}</div></Surface><Surface eyebrow="OBSERVAÇÕES" title="Memória operacional"><div className="observation-list">{observations.slice(0,6).map((x,i)=><div key={x?.id||i}><span>{text(x?.type||x?.category,'sinal')}</span><p>{text(x?.summary||x?.observation||x?.description,'Observação registrada.')}</p></div>)}{!observations.length&&<p className="muted-copy">Nenhuma observação estruturada disponível.</p>}</div></Surface></div>
  </div>
}
