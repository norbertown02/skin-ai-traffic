import React, { useEffect, useMemo, useState } from 'react'
import { HorizontalBars, RetentionChart } from '../components/Charts.jsx'
import { Badge, DataTable, MiniMetric, PageHeader, Surface } from '../components/UI.jsx'
import { cleanCreativeName, integer, money, num, pct } from '../lib/format.js'
import { classifyFunnelContext, stageLabel, summarizeContexts } from '../lib/funnelContext.js'
import { loadVideoInsight } from '../api.js'

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
  if (purchases >= 2 && roas >= 1) return { label: 'Vencedor', tone: 'success', key: 'winner' }
  if (purchases > 0) return { label: 'Promissor', tone: 'info', key: 'promising' }
  if (spend >= 60 && purchases === 0 && ctr < benchmark * .7) return { label: 'Atenção', tone: 'danger', key: 'attention' }
  if (spend >= 60 && purchases === 0) return { label: 'Pós-clique', tone: 'warning', key: 'postclick' }
  return { label: 'Em teste', tone: 'neutral', key: 'testing' }
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
  const [selected,setSelected]=useState(null)
  const [detailTab,setDetailTab]=useState('overview')
  const [video,setVideo]=useState(null)
  const [videoLoading,setVideoLoading]=useState(false)
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

  const visible=enriched.filter(x=>(filter==='all'||x.state.key===filter)&&(roleFilter==='all'||x.message.role===roleFilter))
  const selectedLive=selected?enriched.find(x=>String(x.id)===String(selected.id))||selected:null

  async function openCreative(item){
    setSelected(item);setDraft({...item.message});setDetailTab('overview');setVideo(null);setVideoError('');setVideoLoading(true)
    try{const result=await loadVideoInsight(item.id);setVideo(result?.available?result:null);if(!result?.available)setVideoError(result?.is_video===false?'Este criativo não é vídeo.':'A Meta não retornou retenção disponível para este criativo.')}
    catch{setVideoError('Retenção de vídeo indisponível no momento. Os demais dados continuam válidos.')}
    finally{setVideoLoading(false)}
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
  const winners=enriched.filter(x=>x.state.key==='winner').length
  const review=enriched.filter(x=>['attention','postclick'].includes(x.state.key)).length
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
      <div className="pro-stat"><div><span>Criativos com entrega</span></div><strong>{integer(enriched.length)}</strong><small>{money(totalSpend)} investidos</small></div>
      <div className="pro-stat"><div><span>Vencedores</span></div><strong>{integer(winners)}</strong><small>Compra + eficiência</small></div>
      <div className="pro-stat"><div><span>Precisam revisão</span></div><strong>{integer(review)}</strong><small>Atenção ou pós-clique</small></div>
      <div className="pro-stat"><div><span>Compras atribuídas</span></div><strong>{integer(totalPurchases)}</strong><small>CTR benchmark {pct(benchmark)}</small></div>
    </div>

    <section className="creative-strategy-coverage">
      <div className="creative-strategy-head"><div><span>COBERTURA DE MENSAGEM</span><h2>Que tipo de mensagem estamos produzindo</h2><p>Esta visão não define o funil. Ela mostra a função criativa; o estágio é calculado na mídia a partir do conjunto e da audiência.</p></div><div className="coverage-note"><span>Regra</span><strong>Funil ≠ criativo</strong></div></div>
      <div className="coverage-grid four">{roleCoverage.map(x=><button key={x.key} className={roleFilter===x.key?'active':''} onClick={()=>setRoleFilter(roleFilter===x.key?'all':x.key)}><span>{x.label}</span><strong>{integer(x.count)}</strong><small>{money(x.spend)} investidos</small></button>)}</div>
    </section>

    <div className="tabs pro-tabs">{[['all','Todos'],['winner','Vencedores'],['promising','Promissores'],['attention','Atenção'],['postclick','Pós-clique'],['testing','Em teste']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div>

    <div className="pro-creative-grid">{visible.map(item=><article className="pro-creative-card" key={item.id} onClick={()=>openCreative(item)}>
      <div className="pro-creative-media">{item.image_url||item.thumbnail_url?<img src={item.image_url||item.thumbnail_url} alt="" loading="lazy"/>:<div>SKIN</div>}<Badge tone={item.state.tone}>{item.state.label}</Badge></div>
      <div className="pro-creative-body"><div className="creative-strategy-tags"><span>{labelOf(roles,item.message.role)}</span><span>{labelOf(concepts,item.message.concept)}</span><span>Usado em {stageLabel(item.contextSummary.dominant)}</span></div><h3>{cleanCreativeName(item.name,'Criativo')}</h3><p>{item.headline||item.primary_text||item.hook||'Sem headline estruturada.'}</p><div><span><small>Gasto</small><strong>{money(item.metrics?.spend)}</strong></span><span><small>ROAS</small><strong>{num(item.metrics?.roas)}</strong></span><span><small>CTR</small><strong>{pct(item.metrics?.ctr)}</strong></span><span><small>Compras</small><strong>{integer(item.metrics?.purchases)}</strong></span></div></div>
    </article>)}</div>

    {selectedLive&&<div className="creative-detail-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><section className="creative-detail-shell">
      <header className="creative-detail-topbar"><div><span>ANÁLISE DO CRIATIVO</span><strong>{cleanCreativeName(selectedLive.name,'Criativo')}</strong></div><button onClick={()=>setSelected(null)}>Fechar ×</button></header>
      <div className="creative-detail-hero">
        <div className="creative-detail-media">{selectedLive.image_url||selectedLive.thumbnail_url?<img src={selectedLive.image_url||selectedLive.thumbnail_url} alt=""/>:<div className="creative-detail-placeholder">SKIN</div>}</div>
        <div className="creative-detail-summary"><div className="creative-detail-status"><Badge tone={selectedLive.state.tone}>{selectedLive.state.label}</Badge><span>{text(selectedLive.format||selectedLive.media_type||selectedLive.type,'Peça de mídia')}</span></div><h2>{selectedLive.headline||cleanCreativeName(selectedLive.name,'Criativo')}</h2><p>{selectedLive.primary_text||selectedLive.hook||'Sem texto principal estruturado para esta peça.'}</p>
          <div className="creative-role-summary"><div><span>FUNÇÃO DA MENSAGEM</span><strong>{labelOf(roles,selectedLive.message.role)}</strong><small>{labelOf(concepts,selectedLive.message.concept)}</small></div><div><span>CONTEXTO DOMINANTE</span><strong>{stageLabel(context.dominant)}</strong><small>Definido pelos conjuntos/audiências onde a peça roda</small></div></div>
          <div className="creative-detail-diagnosis"><span>LEITURA</span><strong>{diagnosis.title}</strong><p>{diagnosis.text}</p></div>
          <div className="creative-detail-scoreline"><Metric label="Gasto" value={money(selectedMetrics.spend)}/><Metric label="Compras" value={integer(selectedPurchases)}/><Metric label="ROAS" value={num(selectedRoas)}/><Metric label="CAC" value={money(selectedCac)}/></div>
        </div>
      </div>

      <nav className="creative-detail-tabs">{[['overview','Visão geral'],['strategy','Mensagem & funil'],['video','Vídeo'],['audience','Públicos'],['placements','Placements']].map(([k,l])=><button key={k} className={detailTab===k?'active':''} onClick={()=>setDetailTab(k)}>{l}</button>)}</nav>
      <div className="creative-detail-content">
        {detailTab==='overview'&&<><div className="creative-metric-mosaic"><Metric label="Impressões" value={integer(selectedImpressions)}/><Metric label="Cliques" value={integer(selectedClicks)}/><Metric label="CTR" value={pct(selectedCtr)} helper={`benchmark ${pct(benchmark)}`}/><Metric label="CPC" value={money(selectedCpc)}/><Metric label="CPM" value={money(selectedCpm)}/><Metric label="Receita atribuída" value={money(selectedRevenue)}/><Metric label="ROAS" value={num(selectedRoas)}/><Metric label="CAC" value={money(selectedCac)}/></div><div className="creative-detail-grid-two"><Surface eyebrow="FUNIL DA PEÇA" title="Da impressão até a compra"><div className="creative-funnel-mini"><div><span>Impressões</span><strong>{integer(selectedImpressions)}</strong><em>100%</em></div><div><span>Cliques</span><strong>{integer(selectedClicks)}</strong><em>{pct(rate(selectedClicks,selectedImpressions))}</em></div><div><span>Compras</span><strong>{integer(selectedPurchases)}</strong><em>{pct(rate(selectedPurchases,selectedClicks))}</em></div></div></Surface><Surface eyebrow="CONTEXTO" title="Onde essa peça está sendo usada"><div className="creative-read-list"><p><span>01</span><strong>Topo</strong><em>{integer(context.count.top)} contexto(s) · {money(context.spend.top)}</em></p><p><span>02</span><strong>Meio</strong><em>{integer(context.count.middle)} contexto(s) · {money(context.spend.middle)}</em></p><p><span>03</span><strong>Fundo</strong><em>{integer(context.count.bottom)} contexto(s) · {money(context.spend.bottom)}</em></p></div></Surface></div></>}

        {detailTab==='strategy'&&<div className="creative-strategy-editor"><Surface eyebrow="CRIATIVO" title="Classificação da mensagem"><p className="muted-copy">Aqui classificamos somente o que a peça comunica. O estágio do funil não é editado no criativo.</p><div className="creative-strategy-form"><StrategySelect label="Função da mensagem" value={draft?.role||'attention'} onChange={v=>setDraft(d=>({...d,role:v}))} options={roles}/><StrategySelect label="Conceito" value={draft?.concept||'product'} onChange={v=>setDraft(d=>({...d,concept:v}))} options={concepts}/></div><div className="strategy-editor-actions"><button className="btn primary" onClick={saveCreativeMessage}>Salvar classificação</button><button className="btn" onClick={resetCreativeMessage}>Usar sugestão automática</button></div></Surface><Surface eyebrow="MÍDIA" title="Contexto de funil detectado"><div className="creative-observed-read"><div><span>Contexto dominante</span><strong>{stageLabel(context.dominant)}</strong></div><div><span>Conjuntos mapeados</span><strong>{integer(context.total)}</strong></div><p>Topo {integer(context.count.top)} · Meio {integer(context.count.middle)} · Fundo {integer(context.count.bottom)} · Clientes {integer(context.count.customer)} · Misto {integer(context.count.mixed)}</p><small>Essa classificação vem do nome/tipo de audiência e do contexto disponível do conjunto. Quando o targeting não está exposto pela API, marcamos como “Não classificado” em vez de inventar precisão.</small></div></Surface></div>}

        {detailTab==='video'&&<Surface eyebrow="VÍDEO" title="Retenção e consumo"><div>{videoLoading?<p className="muted-copy">Consultando retenção deste criativo…</p>:video?<><div className="mini-metric-grid four"><MiniMetric label="Plays" value={integer(video.plays)}/><MiniMetric label="Play rate" value={pct(video.play_rate_pct)}/><MiniMetric label="Tempo médio" value={`${num(video.avg_watch_seconds,1)}s`}/><MiniMetric label="ThruPlay" value={pct(video.thruplay_rate_pct)}/></div><div className="creative-retention-wrap"><RetentionChart retention={video.retention_pct} height={300}/></div></>:<div className="creative-empty-state"><strong>Retenção indisponível</strong><p>{videoError||'A Meta não retornou dados de retenção para essa peça.'}</p></div>}</div></Surface>}

        {detailTab==='audience'&&<div className="creative-detail-grid-two"><HorizontalBars title="Gasto por conjunto" subtitle="Onde a peça recebeu investimento" rows={audienceRows.map((x,i)=>({key:x.ad_set_name||x.audience_type||`Público ${i+1}`,spend:n(x.spend)}))} valueKey="spend" formatValue={money}/><Surface eyebrow="DETALHE" title="Contexto por conjunto"><DataTable compact rows={audienceRows.slice(0,30)} columns={[{key:'ad_set_name',label:'Conjunto'},{key:'_funnel',label:'Funil',render:r=>stageLabel(r._funnel.stage)},{key:'audience_type',label:'Público'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>}
        {detailTab==='placements'&&<div className="creative-detail-grid-two"><HorizontalBars title="Gasto por placement" subtitle="Distribuição da peça" rows={placementRows.map((x,i)=>({key:`${x.publisher_platform||'—'} · ${x.platform_position||`Posição ${i+1}`}`,spend:n(x.spend)}))} valueKey="spend" formatValue={money}/><Surface eyebrow="DETALHE" title="Performance por placement"><DataTable compact rows={placementRows.slice(0,20)} columns={[{key:'publisher_platform',label:'Plataforma'},{key:'platform_position',label:'Posição'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface></div>}
      </div>
    </section></div>}
  </div>
}
