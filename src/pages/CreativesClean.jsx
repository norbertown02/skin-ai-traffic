import React, { useEffect, useMemo, useState } from 'react'
import { HorizontalBars, RetentionChart } from '../components/Charts.jsx'
import { Badge, DataTable, MiniMetric, PageHeader, Surface } from '../components/UI.jsx'
import { cleanCreativeName, integer, money, num, pct } from '../lib/format.js'
import { classifyFunnelContext, stageLabel, summarizeContexts } from '../lib/funnelContext.js'
import { videoSummary } from '../../supabase/functions/traffic-report/report.mjs'

const n=v=>Number(v||0)
const rate=(a,b)=>n(b)?n(a)/n(b)*100:0
const text=(v,f='—')=>v===null||v===undefined||v===''?f:String(v)
const STORAGE_KEY='skin_creative_message_v2'

const roles=[['attention','Atenção'],['education','Educação'],['consideration','Consideração'],['conversion','Conversão']]
const concepts=[['pain','Dor'],['benefit','Benefício'],['demonstration','Demonstração'],['social_proof','Prova social'],['offer','Oferta'],['product','Produto'],['education','Educação'],['comparison','Comparação'],['lifestyle','Lifestyle']]
const labelOf=(list,key)=>list.find(x=>x[0]===key)?.[1]||'—'

function loadMessageMap(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}}
function saveMessageMap(value){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value))}catch{}}

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

function inferRole(item,concept){
  if(concept==='offer'||/compre|garanta|aproveite|últimas|ultimas/.test(`${item?.headline||''} ${item?.primary_text||''}`.toLowerCase())) return 'conversion'
  if(['social_proof','demonstration','comparison','education'].includes(concept)) return 'consideration'
  if(concept==='pain'||concept==='benefit'||concept==='lifestyle') return 'attention'
  return 'education'
}

function inferMessage(item){
  const concept=inferConcept(item)
  return {role:inferRole(item,concept),concept,source:'auto'}
}

function creativeState(profile, benchmark) {
  const m = profile?.metrics || {}
  const spend = n(m.spend), purchases = n(m.purchases), roas = n(m.roas), ctr = n(m.ctr)
  if (spend===0 && purchases===0) return { label: 'Sem entrega', tone: 'neutral', key: 'idle' }
  if (purchases >= 3 && roas >= 2) return { label: 'Sinal de escala', tone: 'success', key: 'winner' }
  if (purchases > 0) return { label: 'Promissor', tone: 'info', key: 'promising' }
  if (spend >= 60 && purchases === 0 && ctr < benchmark * .7) return { label: 'Atenção', tone: 'danger', key: 'attention' }
  if (spend >= 60 && purchases === 0) return { label: 'Pós-clique', tone: 'warning', key: 'postclick' }
  return { label: 'Em teste', tone: 'neutral', key: 'testing' }
}

function CreativeMedia({item,large=false}){
 const [broken,setBroken]=useState(false)
 const url=item.image_url||item.thumbnail_url
 useEffect(()=>setBroken(false),[url])
 const likelyTiny=!item.image_url && !!item.thumbnail_url && /(?:p64x64|\/p64|_p64|64x64)/i.test(item.thumbnail_url)
 return <div className={'skin-media-frame '+(large?'is-large':'')+(likelyTiny?' is-tiny':'')}>
  {url&&!broken?<img src={url} alt={'Prévia: '+displayCreativeName(item)} loading={large?'eager':'lazy'} onError={()=>setBroken(true)} />:<div className="skin-no-preview"><strong>Prévia indisponível</strong><small>O Meta não forneceu uma imagem acessível.</small></div>}
  {likelyTiny&&!broken&&<span className="skin-preview-note">Miniatura reduzida do Meta</span>}
  {item.video_id&&<span className="skin-video-indicator">▶ Vídeo</span>}
 </div>
}
function displayCreativeName(item){
 let raw=String(item?.name||item?.ads?.[0]?.name||'Criativo sem nome').trim()
 raw=raw.replace(/\s+20\d{2}-\d{2}-\d{2}-[a-f0-9]{20,}\s*$/i,'')
   .replace(/(?:^|\s)[a-f0-9]{24,}\s*$/i,'')
   .replace(/\s+(?:20\d{2}-\d{2}-\d{2})\s*$/,'')
   .replace(/\s{2,}/g,' ').trim()
 if(/^\{\{[^}]+\}\}$/.test(raw)) return cleanCreativeName(item?.ads?.[0]?.name,'Anúncio dinâmico de catálogo')
 if(/^skin beauty cosm[eé]ticos$/i.test(raw) && item?.ads?.[0]?.name) raw=item.ads[0].name
 return cleanCreativeName(raw||item?.ads?.[0]?.name,'Criativo')
}

function Metric({label,value,helper}){return <div className="creative-detail-metric"><span>{label}</span><strong>{value}</strong>{helper&&<small>{helper}</small>}</div>}
function StrategySelect({label,value,onChange,options}){return <label className="creative-strategy-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>}

function diagnose(item, benchmark){
  const m=item?.metrics||{}, ctr=n(m.ctr), spend=n(m.spend)
  if(item?.state?.key==='winner') return {title:'Peça com sinal de escala',text:'A peça combina compras e retorno. A decisão deve considerar em qual contexto de público esse resultado ocorreu antes de ampliar entrega.'}
  if(item?.state?.key==='promising') return {title:'Sinal positivo, ainda sem volume',text:'Já existe compra atribuída, mas a amostra ainda é pequena. Preserve a peça e compare Topo, Meio e Fundo separadamente.'}
  if(item?.state?.key==='attention') return {title:'A mensagem perde atenção',text:`CTR de ${pct(ctr)} está abaixo do benchmark (${pct(benchmark)}). Revise hook e proposta visual, sem confundir esse sinal com o estágio do funil.`}
  if(item?.state?.key==='postclick') return {title:'Clique existe; compra não acompanha',text:`A peça já consumiu ${money(spend)} sem compra relevante. Verifique em quais conjuntos ela roda antes de concluir que o problema é o criativo.`}
  return {title:'Ainda em aprendizado',text:'A peça não acumulou amostra suficiente. O contexto de campanha/conjunto deve orientar a leitura do resultado.'}
}

export default function CreativesClean({ data }) {
  const profiles=data?.deep?.creative_profiles||[]
  const benchmark=n(data?.deep?.benchmarks?.avg_ctr)
  const [filter,setFilter]=useState('all')
  const [roleFilter,setRoleFilter]=useState('all')
  const [statusFilter,setStatusFilter]=useState('delivered')
  const [mediaFilter,setMediaFilter]=useState('all')
  const [query,setQuery]=useState('')
  const [sortBy,setSortBy]=useState('spend')
  const [selected,setSelected]=useState(null)
  const [detailTab,setDetailTab]=useState('overview')
  const [video,setVideo]=useState(null)
  const [videoError,setVideoError]=useState('')
  const [messageMap,setMessageMap]=useState(loadMessageMap)
  const [draft,setDraft]=useState(null)

  useEffect(()=>saveMessageMap(messageMap),[messageMap])
  useEffect(()=>{
    if(!selected) return
    const bodyOverflow=document.body.style.overflow, htmlOverflow=document.documentElement.style.overflow
    document.body.style.overflow='hidden'; document.documentElement.style.overflow='hidden'
    return()=>{document.body.style.overflow=bodyOverflow;document.documentElement.style.overflow=htmlOverflow}
  },[selected])

  const enriched=useMemo(()=>profiles.map(p=>{
    const auto=inferMessage(p), saved=messageMap[p.id]
    const message=saved?{...auto,...saved,source:'manual'}:auto
    const contextSummary=summarizeContexts(p.audiences||[])
    return {...p,state:creativeState(p,benchmark),message,contextSummary}
  }),[profiles,benchmark,messageMap])

  const visible=enriched.filter(x=>(filter==='all'||x.state.key===filter)&&(roleFilter==='all'||x.message.role===roleFilter)
   &&(statusFilter==='all'||(statusFilter==='active'?x.active:statusFilter==='inactive'?!x.active:statusFilter==='delivered'?x.delivered:!x.delivered))
   &&(mediaFilter==='all'||(mediaFilter==='video'?Boolean(x.video_id):mediaFilter==='image'?!x.video_id&&Boolean(x.image_url||x.thumbnail_url):!x.image_url&&!x.thumbnail_url))
   &&(!query||[displayCreativeName(x),x.name,x.headline,x.primary_text,...(x.ads||[]).map(a=>a.name)].join(' ').toLowerCase().includes(query.toLowerCase())))
   .sort((a,b)=>sortBy==='roas'?n(b.metrics?.roas)-n(a.metrics?.roas):sortBy==='purchases'?n(b.metrics?.purchases)-n(a.metrics?.purchases):sortBy==='name'?displayCreativeName(a).localeCompare(displayCreativeName(b),'pt-BR'):n(b.metrics?.spend)-n(a.metrics?.spend))
  const selectedLive=selected?enriched.find(x=>String(x.id)===String(selected.id))||selected:null

  function openCreative(item){
    setSelected(item);setDraft({...item.message});setDetailTab('overview')
    const result = videoSummary(item)
    setVideo(result.available ? result : null)
    setVideoError(result.is_video ? 'A Meta ainda não retornou retenção para este criativo.' : 'Este criativo não é vídeo.')
  }

  function saveCreativeMessage(){
    if(!selectedLive||!draft)return
    setMessageMap(prev=>({...prev,[selectedLive.id]:{role:draft.role,concept:draft.concept,updated_at:new Date().toISOString()}}))
  }
  function resetCreativeMessage(){
    if(!selectedLive)return
    setMessageMap(prev=>{const next={...prev};delete next[selectedLive.id];return next})
    setDraft(inferMessage(selectedLive))
  }

  const totalSpend=enriched.reduce((a,x)=>a+n(x.metrics?.spend),0)
  const totalPurchases=enriched.reduce((a,x)=>a+n(x.metrics?.purchases),0)
  const winners=enriched.filter(x=>x.delivered&&x.state.key==='winner').length
  const review=enriched.filter(x=>x.delivered&&['attention','postclick'].includes(x.state.key)).length
  const delivered=enriched.filter(x=>x.delivered)
   const topCandidate=delivered.filter(x=>n(x.metrics?.spend)>=20&&n(x.metrics?.purchases)>0).slice().sort((a,b)=>n(b.metrics?.roas)-n(a.metrics?.roas))[0]
   const attentionCandidate=delivered.filter(x=>n(x.metrics?.spend)>=60&&n(x.metrics?.purchases)===0).slice().sort((a,b)=>n(b.metrics?.spend)-n(a.metrics?.spend))[0]
   const mediaLimited=enriched.filter(x=>!x.image_url&&(!x.thumbnail_url||/p64x64/i.test(x.thumbnail_url))).length
   const roleCoverage=roles.map(([key,label])=>({key,label,count:enriched.filter(x=>x.message.role===key).length,spend:enriched.filter(x=>x.message.role===key).reduce((a,x)=>a+n(x.metrics?.spend),0)}))

  const selectedMetrics=selectedLive?.metrics||{}
  const selectedImpressions=n(selectedMetrics.impressions||selectedMetrics.imp)
  const selectedClicks=n(selectedMetrics.clicks||selectedMetrics.link_clicks)
  const selectedRevenue=n(selectedMetrics.revenue||selectedMetrics.rev)
  const selectedCpc=n(selectedMetrics.cpc)||(selectedClicks?n(selectedMetrics.spend)/selectedClicks:0)
  const selectedCpm=n(selectedMetrics.cpm)||(selectedImpressions?n(selectedMetrics.spend)/selectedImpressions*1000:0)
  const selectedCtr=n(selectedMetrics.ctr)||(selectedImpressions?selectedClicks/selectedImpressions*100:0)
  const selectedPurchases=n(selectedMetrics.purchases)
  const selectedCac=n(selectedMetrics.cac)||(selectedPurchases?n(selectedMetrics.spend)/selectedPurchases:0)
  const selectedRoas=n(selectedMetrics.roas)||(n(selectedMetrics.spend)?selectedRevenue/n(selectedMetrics.spend):0)
  const diagnosis=selectedLive?diagnose(selectedLive,benchmark):null
  const audienceRows=(selectedLive?.audiences||[]).slice().sort((a,b)=>n(b.spend)-n(a.spend)).map(r=>({...r,_funnel:classifyFunnelContext(r)}))
  const placementRows=(selectedLive?.placements||[]).slice().sort((a,b)=>n(b.spend)-n(a.spend))
  const context=selectedLive?.contextSummary||summarizeContexts([])

  return <div className="page pro-page creatives-page">
    <PageHeader eyebrow="CRIATIVOS" title="Inteligência criativa" description="O criativo descreve a mensagem. Topo, Meio e Fundo agora vêm do contexto de campanha, conjunto e audiência — e a mesma peça pode aparecer em mais de um estágio." />

    <div className="pro-stat-grid four">
      <div className="pro-stat"><div><span>Criativos no catálogo</span></div><strong>{integer(enriched.length)}</strong><small>{integer(enriched.filter(x=>x.delivered).length)} com entrega no período · {money(totalSpend)}</small></div>
      <div className="pro-stat"><div><span>Sinais de escala</span></div><strong>{integer(winners)}</strong><small>3+ compras e ROAS ≥ 2 (triagem)</small></div>
      <div className="pro-stat"><div><span>Precisam revisão</span></div><strong>{integer(review)}</strong><small>Atenção ou pós-clique</small></div>
      <div className="pro-stat"><div><span>Compras atribuídas</span></div><strong>{integer(totalPurchases)}</strong><small>CTR benchmark {pct(benchmark)}</small></div>
    </div>

    <section className="skin-creative-insights" aria-label="Diagnóstico operacional dos criativos">
      <article><span>MAIOR RETORNO COM AMOSTRA</span><strong>{topCandidate?displayCreativeName(topCandidate):'Amostra insuficiente'}</strong><small>{topCandidate?`ROAS ${num(topCandidate.metrics?.roas)} · ${integer(topCandidate.metrics?.purchases)} compras · ${money(topCandidate.metrics?.spend)} investidos`:'Nenhuma peça com compras e ao menos R$ 20 de gasto neste período.'}</small></article>
      <article><span>VERBA SEM COMPRAS</span><strong>{attentionCandidate?displayCreativeName(attentionCandidate):'Nenhum alerta relevante'}</strong><small>{attentionCandidate?`${money(attentionCandidate.metrics?.spend)} investidos · 0 compras`:'Critério de alerta: gasto ≥ R$ 60 sem compras atribuídas.'}</small></article>
      <article><span>QUALIDADE DO ACERVO</span><strong>{integer(mediaLimited)} prévias limitadas</strong><small>Imagens de baixa resolução ou indisponíveis na origem. Não representam erro de performance.</small></article>
    </section>
    <section className="creative-strategy-coverage">
      <div className="creative-strategy-head"><div><span>COBERTURA DE MENSAGEM</span><h2>Que tipo de mensagem estamos produzindo</h2><p>Esta visão não define o funil. Ela mostra a função criativa; o estágio é calculado na mídia a partir do conjunto e da audiência.</p></div><div className="coverage-note"><span>Regra</span><strong>Funil ≠ criativo</strong></div></div>
      <div className="coverage-grid four">{roleCoverage.map(x=><button key={x.key} className={roleFilter===x.key?'active':''} onClick={()=>setRoleFilter(roleFilter===x.key?'all':x.key)}><span>{x.label}</span><strong>{integer(x.count)}</strong><small>{money(x.spend)} investidos</small></button>)}</div>
    </section>

    <div className="skin-creative-toolbar" aria-label="Filtros de criativos">
       <label>Status atual <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
        <option value="delivered">Com entrega no período</option><option value="active">Somente ativos agora</option><option value="inactive">Pausados ou inativos</option><option value="idle">Sem entrega no período</option><option value="all">Todos os criativos cadastrados</option>
       </select></label>
       <label>Formato <select value={mediaFilter} onChange={e=>setMediaFilter(e.target.value)}><option value="all">Todos</option><option value="video">Vídeo</option><option value="image">Imagem</option><option value="missing">Sem prévia</option></select></label>
       <label>Ordenar <select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="spend">Maior investimento</option><option value="purchases">Mais compras</option><option value="roas">Melhor ROAS</option><option value="name">Nome A–Z</option></select></label>
       <label className="skin-creative-search">Buscar criativo <input type="search" placeholder="Nome, anúncio ou texto" value={query} onChange={e=>setQuery(e.target.value)} /></label>
       <span className="skin-results-count">{integer(visible.length)} de {integer(enriched.length)} criativos</span>
    </div>
    <p className="skin-status-help">Status ativo/pausado é a situação atual no Meta; métricas e entrega seguem o período selecionado no filtro global. Criativos sem entrega permanecem disponíveis em “Todos”.</p>
    <div className="tabs pro-tabs">{[['all','Todos'],['winner','Vencedores'],['promising','Promissores'],['attention','Atenção'],['postclick','Pós-clique'],['testing','Em teste']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div>

    {!visible.length&&<div className="skin-creative-empty">Nenhum criativo corresponde aos filtros selecionados. Experimente “Todos os criativos cadastrados”.</div>}
    <div className="pro-creative-grid">{visible.map(item=><article className="pro-creative-card" key={item.id} onClick={()=>openCreative(item)}>
      <div className="pro-creative-media"><CreativeMedia item={item}/><Badge tone={item.state.tone}>{item.state.label}</Badge></div>
      <div className="pro-creative-body"><div className="creative-strategy-tags"><span>{labelOf(roles,item.message.role)}</span><span>{labelOf(concepts,item.message.concept)}</span><span>{item.active?'Ativo agora':'Inativo agora'}</span><span>{item.delivered?'Com entrega':'Sem entrega'}</span><span>Funil: {stageLabel(item.contextSummary.dominant)}</span></div><h3>{displayCreativeName(item)}</h3><p>{item.headline||item.primary_text||item.hook||item.ads?.[0]?.name||'Sem headline estruturada.'}</p><div><span><small>Gasto</small><strong>{money(item.metrics?.spend)}</strong></span><span><small>ROAS</small><strong>{num(item.metrics?.roas)}</strong></span><span><small>CTR</small><strong>{pct(item.metrics?.ctr)}</strong></span><span><small>Compras</small><strong>{integer(item.metrics?.purchases)}</strong></span></div></div>
    </article>)}</div>

    {selectedLive&&<div className="creative-detail-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><section className="creative-detail-shell">
      <header className="creative-detail-topbar"><div><span>ANÁLISE DO CRIATIVO</span><strong>{displayCreativeName(selectedLive)}</strong></div><button onClick={()=>setSelected(null)}>Fechar ×</button></header>
      <div className="creative-detail-hero">
        <div className="creative-detail-media"><CreativeMedia item={selectedLive} large/></div>
        <div className="creative-detail-summary"><div className="creative-detail-status"><Badge tone={selectedLive.state.tone}>{selectedLive.state.label}</Badge><span>{selectedLive.video_id?'Vídeo':'Imagem ou catálogo'}</span><span>{selectedLive.active?'Ativo agora':'Não ativo agora'}</span></div><h2>{displayCreativeName(selectedLive)}</h2><p>{selectedLive.primary_text||selectedLive.hook||'Sem texto principal estruturado para esta peça.'}</p>
          <div className="creative-role-summary"><div><span>FUNÇÃO DA MENSAGEM</span><strong>{labelOf(roles,selectedLive.message.role)}</strong><small>{labelOf(concepts,selectedLive.message.concept)}</small></div><div><span>CONTEXTO DOMINANTE</span><strong>{stageLabel(context.dominant)}</strong><small>Definido pelos conjuntos/audiências onde a peça roda</small></div></div>
          <div className="creative-detail-diagnosis"><span>LEITURA</span><strong>{diagnosis.title}</strong><p>{diagnosis.text}</p></div>
          <div className="creative-detail-scoreline"><Metric label="Gasto" value={money(selectedMetrics.spend)}/><Metric label="Compras" value={integer(selectedPurchases)}/><Metric label="ROAS" value={num(selectedRoas)}/><Metric label="CAC" value={money(selectedCac)}/></div>
        </div>
      </div>

      <nav className="creative-detail-tabs">{[['overview','Visão geral'],['strategy','Mensagem & funil'],['video','Vídeo'],['audience','Públicos'],['placements','Placements']].map(([k,l])=><button key={k} className={detailTab===k?'active':''} onClick={()=>setDetailTab(k)}>{l}</button>)}</nav>
      <div className="creative-detail-content">
        {detailTab==='overview'&&<><div className="creative-metric-mosaic"><Metric label="Impressões" value={integer(selectedImpressions)}/><Metric label="Cliques" value={integer(selectedClicks)}/><Metric label="CTR" value={pct(selectedCtr)} helper={`benchmark ${pct(benchmark)}`}/><Metric label="CPC" value={money(selectedCpc)}/><Metric label="CPM" value={money(selectedCpm)}/><Metric label="Receita atribuída" value={money(selectedRevenue)}/><Metric label="ROAS" value={num(selectedRoas)}/><Metric label="CAC" value={money(selectedCac)}/></div><div className="creative-detail-grid-two"><Surface eyebrow="FUNIL DA PEÇA" title="Da impressão até a compra"><div className="creative-funnel-mini"><div><span>Impressões</span><strong>{integer(selectedImpressions)}</strong><em>100%</em></div><div><span>Cliques</span><strong>{integer(selectedClicks)}</strong><em>{pct(rate(selectedClicks,selectedImpressions))}</em></div><div><span>Compras</span><strong>{integer(selectedPurchases)}</strong><em>{pct(rate(selectedPurchases,selectedClicks))}</em></div></div></Surface><Surface eyebrow="CONTEXTO" title="Onde essa peça está sendo usada"><div className="creative-read-list"><p><span>01</span><strong>Topo</strong><em>{integer(context.count.top)} contexto(s) · {money(context.spend.top)}</em></p><p><span>02</span><strong>Meio</strong><em>{integer(context.count.middle)} contexto(s) · {money(context.spend.middle)}</em></p><p><span>03</span><strong>Fundo</strong><em>{integer(context.count.bottom)} contexto(s) · {money(context.spend.bottom)}</em></p></div></Surface></div></>}

        {detailTab==='strategy'&&<div className="creative-strategy-editor"><Surface eyebrow="CRIATIVO" title="Classificação da mensagem"><p className="muted-copy">Aqui classificamos somente o que a peça comunica. O estágio do funil não é editado no criativo.</p><div className="creative-strategy-form"><StrategySelect label="Função da mensagem" value={draft?.role||'attention'} onChange={v=>setDraft(d=>({...d,role:v}))} options={roles}/><StrategySelect label="Conceito" value={draft?.concept||'product'} onChange={v=>setDraft(d=>({...d,concept:v}))} options={concepts}/></div><div className="strategy-editor-actions"><button className="btn primary" onClick={saveCreativeMessage}>Salvar classificação</button><button className="btn" onClick={resetCreativeMessage}>Usar sugestão automática</button></div></Surface><Surface eyebrow="MÍDIA" title="Contexto de funil detectado"><div className="creative-observed-read"><div><span>Contexto dominante</span><strong>{stageLabel(context.dominant)}</strong></div><div><span>Conjuntos mapeados</span><strong>{integer(context.total)}</strong></div><p>Topo {integer(context.count.top)} · Meio {integer(context.count.middle)} · Fundo {integer(context.count.bottom)} · Clientes {integer(context.count.customer)} · Misto {integer(context.count.mixed)}</p><small>Essa classificação vem do nome/tipo de audiência e do contexto disponível do conjunto. Quando o targeting não está exposto pela API, marcamos como “Não classificado” em vez de inventar precisão.</small></div></Surface></div>}

        {detailTab==='video'&&<Surface eyebrow="VÍDEO" title="Retenção e consumo"><div>{video?<><div className="mini-metric-grid four"><MiniMetric label="Plays" value={integer(video.plays)}/><MiniMetric label="Play rate" value={pct(video.play_rate_pct)}/></div><div className="creative-retention-wrap"><RetentionChart retention={video.retention_pct} height={300}/></div></>:<div className="creative-empty-state"><strong>Retenção indisponível</strong><p>{videoError||'A Meta não retornou dados de retenção para essa peça.'}</p></div>}</div></Surface>}

        {detailTab==='audience'&&<div className="creative-detail-grid-two"><HorizontalBars title="Gasto por conjunto" subtitle="Onde a peça recebeu investimento" rows={audienceRows.map((x,i)=>({key:x.ad_set_name||x.audience_type||`Público ${i+1}`,spend:n(x.spend)}))} valueKey="spend" formatValue={money}/><Surface eyebrow="DETALHE" title="Contexto por conjunto"><DataTable compact rows={audienceRows.slice(0,30)} columns={[{key:'ad_set_name',label:'Conjunto'},{key:'_funnel',label:'Funil',render:r=>stageLabel(r._funnel.stage)},{key:'audience_type',label:'Público'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>}
        {detailTab==='placements'&&<div className="creative-detail-grid-two"><HorizontalBars title="Gasto por placement" subtitle="Distribuição da peça" rows={placementRows.map((x,i)=>({key:`${x.publisher_platform||'—'} · ${x.platform_position||`Posição ${i+1}`}`,spend:n(x.spend)}))} valueKey="spend" formatValue={money}/><Surface eyebrow="DETALHE" title="Performance por placement"><DataTable compact rows={placementRows.slice(0,20)} columns={[{key:'publisher_platform',label:'Plataforma'},{key:'platform_position',label:'Posição'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>}
      </div>
    </section></div>}
  </div>
}
