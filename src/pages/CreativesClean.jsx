import React, { useMemo, useState } from 'react'
import { RetentionChart } from '../components/Charts.jsx'
import { Badge, DataTable, MiniMetric, PageHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'
import { loadVideoInsight } from '../api.js'

function creativeState(profile, benchmark) {
  const m = profile?.metrics || {}
  const spend = Number(m.spend || 0), purchases = Number(m.purchases || 0), roas = Number(m.roas || 0), ctr = Number(m.ctr || 0)
  if (purchases >= 2 && roas >= 1) return { label: 'Vencedor', tone: 'success', key: 'winner' }
  if (purchases > 0) return { label: 'Promissor', tone: 'info', key: 'promising' }
  if (spend >= 60 && purchases === 0 && ctr < benchmark * .7) return { label: 'Atenção', tone: 'danger', key: 'attention' }
  if (spend >= 60 && purchases === 0) return { label: 'Pós-clique', tone: 'warning', key: 'postclick' }
  return { label: 'Em teste', tone: 'neutral', key: 'testing' }
}

export default function CreativesClean({ data }) {
  const profiles = data?.deep?.creative_profiles || []
  const benchmark = Number(data?.deep?.benchmarks?.avg_ctr || 0)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [video, setVideo] = useState(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')

  const enriched = useMemo(() => profiles.map(p => ({ ...p, state: creativeState(p, benchmark) })), [profiles, benchmark])
  const visible = enriched.filter(x => filter === 'all' || x.state.key === filter)

  async function openCreative(item) {
    setSelected(item); setVideo(null); setVideoError(''); setVideoLoading(true)
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

  return <div className="page pro-page creatives-page">
    <PageHeader eyebrow="CRIATIVOS" title="Inteligência criativa" description="Performance por peça, com leitura de atenção, compra, público, placement e retenção de vídeo sob demanda." />

    <div className="pro-stat-grid four">
      <div className="pro-stat"><div><span>Criativos com entrega</span></div><strong>{integer(enriched.length)}</strong><small>Últimos 30 dias</small></div>
      <div className="pro-stat"><div><span>Vencedores</span></div><strong>{integer(winners)}</strong><small>Compra + eficiência</small></div>
      <div className="pro-stat"><div><span>Precisam revisão</span></div><strong>{integer(review)}</strong><small>Atenção ou pós-clique</small></div>
      <div className="pro-stat"><div><span>CTR benchmark</span></div><strong>{pct(benchmark)}</strong><small>Referência da conta</small></div>
    </div>

    <div className="tabs pro-tabs">{[
      ['all','Todos'],['winner','Vencedores'],['promising','Promissores'],['attention','Atenção'],['postclick','Pós-clique'],['testing','Em teste']
    ].map(([key,label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>

    <div className="pro-creative-grid">{visible.map(item => <article className="pro-creative-card" key={item.id} onClick={() => openCreative(item)}>
      <div className="pro-creative-media">{item.image_url || item.thumbnail_url ? <img src={item.image_url || item.thumbnail_url} alt="" loading="lazy" /> : <div>SKIN</div>}<Badge tone={item.state.tone}>{item.state.label}</Badge></div>
      <div className="pro-creative-body"><h3>{item.name || 'Criativo'}</h3><p>{item.headline || item.primary_text || item.hook || 'Sem headline estruturada.'}</p><div>
        <span><small>Gasto</small><strong>{money(item.metrics?.spend)}</strong></span>
        <span><small>ROAS</small><strong>{num(item.metrics?.roas)}</strong></span>
        <span><small>CTR</small><strong>{pct(item.metrics?.ctr)}</strong></span>
        <span><small>Compras</small><strong>{integer(item.metrics?.purchases)}</strong></span>
      </div></div>
    </article>)}</div>

    {selected && <div className="drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><aside className="creative-drawer">
      <div className="drawer-head"><div><Badge tone={selected.state.tone}>{selected.state.label}</Badge><h2>{selected.name}</h2><p>{selected.primary_text || selected.headline || selected.hook || 'Sem texto estruturado.'}</p></div><button onClick={() => setSelected(null)}>Fechar</button></div>
      <div className="drawer-scroll">
        <div className="mini-metric-grid four"><MiniMetric label="Gasto" value={money(selected.metrics?.spend)} /><MiniMetric label="ROAS" value={num(selected.metrics?.roas)} /><MiniMetric label="CTR" value={pct(selected.metrics?.ctr)} /><MiniMetric label="CAC" value={money(selected.metrics?.cac)} /></div>
        <Surface eyebrow="VÍDEO" title="Retenção"><div>{videoLoading ? <p className="muted-copy">Consultando retenção deste criativo…</p> : video ? <><div className="mini-metric-grid four"><MiniMetric label="Plays" value={integer(video.plays)} /><MiniMetric label="Play rate" value={pct(video.play_rate_pct)} /><MiniMetric label="Tempo médio" value={`${num(video.avg_watch_seconds,1)}s`} /><MiniMetric label="ThruPlay" value={pct(video.thruplay_rate_pct)} /></div><RetentionChart retention={video.retention_pct} /></> : <p className="muted-copy">{videoError || 'Sem dados de retenção disponíveis.'}</p>}</div></Surface>
        <Surface eyebrow="PÚBLICOS" title="Onde esse criativo performa"><DataTable compact rows={(selected.audiences || []).slice(0,12)} columns={[{key:'ad_set_name',label:'Conjunto'},{key:'audience_type',label:'Público'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]} /></Surface>
        <Surface eyebrow="PLACEMENTS" title="Onde esse criativo entrega"><DataTable compact rows={(selected.placements || []).slice(0,12)} columns={[{key:'publisher_platform',label:'Plataforma'},{key:'platform_position',label:'Posição'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]} /></Surface>
      </div>
    </aside></div>}
  </div>
}
