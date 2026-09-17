import React, { useEffect, useMemo, useState } from 'react'
import { HorizontalBars, RetentionChart } from '../components/Charts.jsx'
import { Badge, DataTable, MiniMetric, PageHeader, Surface } from '../components/UI.jsx'
import { cleanAdName, integer, money, num, pct } from '../lib/format.js'
import { loadVideoInsight } from '../api.js'

const n=v=>Number(v||0)
const rate=(a,b)=>n(b)?n(a)/n(b)*100:0
const text=(v,f='—')=>v===null||v===undefined||v===''?f:String(v)

function creativeState(profile, benchmark) {
  const m = profile?.metrics || {}
  const spend = n(m.spend), purchases = n(m.purchases), roas = n(m.roas), ctr = n(m.ctr)
  if (purchases >= 2 && roas >= 1) return { label: 'Vencedor', tone: 'success', key: 'winner' }
  if (purchases > 0) return { label: 'Promissor', tone: 'info', key: 'promising' }
  if (spend >= 60 && purchases === 0 && ctr < benchmark * .7) return { label: 'Atenção', tone: 'danger', key: 'attention' }
  if (spend >= 60 && purchases === 0) return { label: 'Pós-clique', tone: 'warning', key: 'postclick' }
  return { label: 'Em teste', tone: 'neutral', key: 'testing' }
}

function Metric({label,value,helper}){
  return <div className="creative-detail-metric"><span>{label}</span><strong>{value}</strong>{helper&&<small>{helper}</small>}</div>
}

function diagnose(item, benchmark){
  const m=item?.metrics||{}, ctr=n(m.ctr), spend=n(m.spend)
  if(item?.state?.key==='winner') return {title:'Peça com sinal de escala',text:'A peça combina compras e retorno acima do limiar atual. O próximo passo é validar se o resultado se mantém ao ampliar entrega sem deteriorar CTR e CAC.'}
  if(item?.state?.key==='promising') return {title:'Sinal positivo, ainda sem volume',text:'Já existe compra atribuída, mas a amostra ainda é pequena. Vale preservar a peça e ganhar evidência antes de classificá-la como vencedora.'}
  if(item?.state?.key==='attention') return {title:'O problema começa na atenção',text:`CTR de ${pct(ctr)} está abaixo do benchmark da conta (${pct(benchmark)}). Antes de mexer em público ou página, vale revisar hook, primeiro frame e proposta visual.`}
  if(item?.state?.key==='postclick') return {title:'A atenção existe; a conversão não acompanha',text:`A peça já consumiu ${money(spend)} sem compra atribuída relevante. O criativo pode estar gerando clique sem expectativa alinhada à página ou à oferta.`}
  return {title:'Ainda em fase de aprendizado',text:'A peça não acumulou volume suficiente para uma decisão forte. Preserve o teste até existir amostra útil de atenção e fundo de funil.'}
}

export default function CreativesClean({ data }) {
  const profiles = data?.deep?.creative_profiles || []
  const benchmark = n(data?.deep?.benchmarks?.avg_ctr)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [detailTab,setDetailTab]=useState('overview')
  const [video, setVideo] = useState(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')

  useEffect(()=>{
    if(!selected) return
    const bodyOverflow=document.body.style.overflow
    const htmlOverflow=document.documentElement.style.overflow
    document.body.style.overflow='hidden'
    document.documentElement.style.overflow='hidden'
    return ()=>{
      document.body.style.overflow=bodyOverflow
      document.documentElement.style.overflow=htmlOverflow
    }
  },[selected])

  const enriched = useMemo(() => profiles.map(p => ({ ...p, state: creativeState(p, benchmark) })), [profiles, benchmark])
  const visible = enriched.filter(x => filter === 'all' || x.state.key === filter)

  async function openCreative(item) {
    setSelected(item); setDetailTab('overview'); setVideo(null); setVideoError(''); setVideoLoading(true)
    try {
      const result = await loadVideoInsight(item.id)
      setVideo(result?.available ? result : null)
      if (!result?.available) setVideoError(result?.is_video === false ? 'Este criativo não é vídeo.' : 'A Meta não retornou retenção disponível para este criativo.')
    } catch (e) {
      setVideoError('Retenção de vídeo indisponível no momento. Os demais dados do criativo continuam válidos.')
    } finally { setVideoLoading(false) }
  }

  const winners = enriched.filter(x => x.state.key === 'winner').length
  const review = enriched.filter(x => ['attention','postclick'].includes(x.state.key)).length
  const totalSpend=enriched.reduce((a,x)=>a+n(x.metrics?.spend),0)
  const totalPurchases=enriched.reduce((a,x)=>a+n(x.metrics?.purchases),0)

  const selectedMetrics=selected?.metrics||{}
  const selectedImpressions=n(selectedMetrics.impressions||selectedMetrics.imp)
  const selectedClicks=n(selectedMetrics.clicks||selectedMetrics.link_clicks)
  const selectedRevenue=n(selectedMetrics.revenue||selectedMetrics.rev)
  const selectedCpc=n(selectedMetrics.cpc)||(selectedClicks?n(selectedMetrics.spend)/selectedClicks:0)
  const selectedCpm=n(selectedMetrics.cpm)||(selectedImpressions?n(selectedMetrics.spend)/selectedImpressions*1000:0)
  const selectedCtr=n(selectedMetrics.ctr)||(selectedImpressions?selectedClicks/selectedImpressions*100:0)
  const selectedPurchases=n(selectedMetrics.purchases)
  const selectedCac=n(selectedMetrics.cac)||(selectedPurchases?n(selectedMetrics.spend)/selectedPurchases:0)
  const selectedRoas=n(selectedMetrics.roas)||(n(selectedMetrics.spend)?selectedRevenue/n(selectedMetrics.spend):0)
  const diagnosis=selected?diagnose(selected,benchmark):null
  const audienceRows=(selected?.audiences||[]).slice().sort((a,b)=>n(b.spend)-n(a.spend))
  const placementRows=(selected?.placements||[]).slice().sort((a,b)=>n(b.spend)-n(a.spend))

  return <div className="page pro-page creatives-page">
    <PageHeader eyebrow="CRIATIVOS" title="Inteligência criativa" description="Performance por peça, com leitura de atenção, compra, público, placement e retenção de vídeo sob demanda." />

    <div className="pro-stat-grid four">
      <div className="pro-stat"><div><span>Criativos com entrega</span></div><strong>{integer(enriched.length)}</strong><small>{money(totalSpend)} investidos</small></div>
      <div className="pro-stat"><div><span>Vencedores</span></div><strong>{integer(winners)}</strong><small>Compra + eficiência</small></div>
      <div className="pro-stat"><div><span>Precisam revisão</span></div><strong>{integer(review)}</strong><small>Atenção ou pós-clique</small></div>
      <div className="pro-stat"><div><span>Compras atribuídas</span></div><strong>{integer(totalPurchases)}</strong><small>CTR benchmark {pct(benchmark)}</small></div>
    </div>

    <div className="tabs pro-tabs">{[
      ['all','Todos'],['winner','Vencedores'],['promising','Promissores'],['attention','Atenção'],['postclick','Pós-clique'],['testing','Em teste']
    ].map(([key,label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>

    <div className="pro-creative-grid">{visible.map(item => <article className="pro-creative-card" key={item.id} onClick={() => openCreative(item)}>
      <div className="pro-creative-media">{item.image_url || item.thumbnail_url ? <img src={item.image_url || item.thumbnail_url} alt="" loading="lazy" /> : <div>SKIN</div>}<Badge tone={item.state.tone}>{item.state.label}</Badge></div>
      <div className="pro-creative-body"><h3>{cleanAdName(item.name,'Criativo')}</h3><p>{item.headline || item.primary_text || item.hook || 'Sem headline estruturada.'}</p><div>
        <span><small>Gasto</small><strong>{money(item.metrics?.spend)}</strong></span>
        <span><small>ROAS</small><strong>{num(item.metrics?.roas)}</strong></span>
        <span><small>CTR</small><strong>{pct(item.metrics?.ctr)}</strong></span>
        <span><small>Compras</small><strong>{integer(item.metrics?.purchases)}</strong></span>
      </div></div>
    </article>)}</div>

    {selected && <div className="creative-detail-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}>
      <section className="creative-detail-shell">
        <header className="creative-detail-topbar"><div><span>ANÁLISE DO CRIATIVO</span><strong>{cleanAdName(selected.name,'Criativo')}</strong></div><button onClick={()=>setSelected(null)}>Fechar ×</button></header>

        <div className="creative-detail-hero">
          <div className="creative-detail-media">{selected.image_url||selected.thumbnail_url?<img src={selected.image_url||selected.thumbnail_url} alt=""/>:<div className="creative-detail-placeholder">SKIN</div>}</div>
          <div className="creative-detail-summary">
            <div className="creative-detail-status"><Badge tone={selected.state.tone}>{selected.state.label}</Badge><span>{text(selected.format||selected.media_type||selected.type,'Peça de mídia')}</span></div>
            <h2>{selected.headline||cleanAdName(selected.name,'Criativo')}</h2>
            <p>{selected.primary_text||selected.hook||'Sem texto principal estruturado para esta peça.'}</p>
            <div className="creative-detail-diagnosis"><span>LEITURA</span><strong>{diagnosis.title}</strong><p>{diagnosis.text}</p></div>
            <div className="creative-detail-scoreline"><Metric label="Gasto" value={money(selectedMetrics.spend)}/><Metric label="Compras" value={integer(selectedPurchases)}/><Metric label="ROAS" value={num(selectedRoas)}/><Metric label="CAC" value={money(selectedCac)}/></div>
          </div>
        </div>

        <nav className="creative-detail-tabs">{[['overview','Visão geral'],['video','Vídeo'],['audience','Públicos'],['placements','Placements']].map(([k,l])=><button key={k} className={detailTab===k?'active':''} onClick={()=>setDetailTab(k)}>{l}</button>)}</nav>

        <div className="creative-detail-content">
          {detailTab==='overview'&&<>
            <div className="creative-metric-mosaic">
              <Metric label="Impressões" value={integer(selectedImpressions)}/><Metric label="Cliques" value={integer(selectedClicks)}/><Metric label="CTR" value={pct(selectedCtr)} helper={`benchmark ${pct(benchmark)}`}/><Metric label="CPC" value={money(selectedCpc)}/><Metric label="CPM" value={money(selectedCpm)}/><Metric label="Receita atribuída" value={money(selectedRevenue)}/><Metric label="ROAS" value={num(selectedRoas)}/><Metric label="CAC" value={money(selectedCac)}/>
            </div>
            <div className="creative-detail-grid-two">
              <Surface eyebrow="FUNIL DA PEÇA" title="Da impressão até a compra"><div className="creative-funnel-mini"><div><span>Impressões</span><strong>{integer(selectedImpressions)}</strong><em>100%</em></div><div><span>Cliques</span><strong>{integer(selectedClicks)}</strong><em>{pct(rate(selectedClicks,selectedImpressions))}</em></div><div><span>Compras</span><strong>{integer(selectedPurchases)}</strong><em>{pct(rate(selectedPurchases,selectedClicks))}</em></div></div></Surface>
              <Surface eyebrow="EFICIÊNCIA" title="Como ler essa peça"><div className="creative-read-list"><p><span>01</span><strong>Atenção</strong><em>{selectedCtr>=benchmark?'Acima':'Abaixo'} do benchmark de CTR</em></p><p><span>02</span><strong>Conversão</strong><em>{selectedPurchases?`${integer(selectedPurchases)} compra(s) atribuída(s)`:'Sem compra atribuída'}</em></p><p><span>03</span><strong>Retorno</strong><em>ROAS {num(selectedRoas)} · CAC {money(selectedCac)}</em></p></div></Surface>
            </div>
          </>}

          {detailTab==='video'&&<Surface eyebrow="VÍDEO" title="Retenção e consumo"><div>{videoLoading ? <p className="muted-copy">Consultando retenção deste criativo…</p> : video ? <><div className="mini-metric-grid four"><MiniMetric label="Plays" value={integer(video.plays)} /><MiniMetric label="Play rate" value={pct(video.play_rate_pct)} /><MiniMetric label="Tempo médio" value={`${num(video.avg_watch_seconds,1)}s`} /><MiniMetric label="ThruPlay" value={pct(video.thruplay_rate_pct)} /></div><div className="creative-retention-wrap"><RetentionChart retention={video.retention_pct} height={300}/></div></> : <div className="creative-empty-state"><strong>Retenção indisponível</strong><p>{videoError || 'A Meta não retornou dados de retenção para essa peça.'}</p></div>}</div></Surface>}

          {detailTab==='audience'&&<div className="creative-detail-grid-two"><HorizontalBars title="Gasto por público" subtitle="Onde a peça recebeu investimento" rows={audienceRows.map((x,i)=>({key:x.ad_set_name||x.audience_type||`Público ${i+1}`,spend:n(x.spend)}))} valueKey="spend" formatValue={money}/><Surface eyebrow="DETALHE" title="Performance por público"><DataTable compact rows={audienceRows.slice(0,20)} columns={[{key:'ad_set_name',label:'Conjunto'},{key:'audience_type',label:'Público'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]} /></Surface></div>}

          {detailTab==='placements'&&<div className="creative-detail-grid-two"><HorizontalBars title="Gasto por placement" subtitle="Distribuição da peça" rows={placementRows.map((x,i)=>({key:`${x.publisher_platform||'—'} · ${x.platform_position||`Posição ${i+1}`}`,spend:n(x.spend)}))} valueKey="spend" formatValue={money}/><Surface eyebrow="DETALHE" title="Performance por placement"><DataTable compact rows={placementRows.slice(0,20)} columns={[{key:'publisher_platform',label:'Plataforma'},{key:'platform_position',label:'Posição'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]} /></Surface></div>}
        </div>
      </section>
    </div>}
  </div>
}
