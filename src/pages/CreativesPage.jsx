import React, { useMemo, useState } from 'react'
import { RetentionChart } from '../components/Charts.jsx'
import { Badge, DataTable, KpiCard, MiniMetric, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'

function creativeState(profile, fatigue, benchmark) {
  const m = profile?.metrics || profile || {}
  const spend = Number(m.spend || 0)
  const purchases = Number(m.purchases || 0)
  const roas = Number(m.roas || 0)
  const ctr = Number(m.ctr || 0)
  if (fatigue?.fatigue_score >= 55) return { label: 'Fadiga', tone: 'warning', key: 'fatigue' }
  if (purchases >= 2 && roas >= 1) return { label: 'Sinal vencedor', tone: 'success', key: 'winner' }
  if (purchases > 0 && roas > 0) return { label: 'Promissor', tone: 'info', key: 'promising' }
  if (spend >= 60 && purchases === 0 && ctr < benchmark * .7) return { label: 'Problema de atenção', tone: 'danger', key: 'attention' }
  if (spend >= 60 && purchases === 0) return { label: 'Revisar pós-clique', tone: 'warning', key: 'postclick' }
  return { label: 'Em teste', tone: 'neutral', key: 'testing' }
}

export default function CreativesPage({ data }) {
  const deep = data?.bootstrap?.deep || {}
  const perf = data?.bootstrap?.performance || {}
  const profiles = deep?.creative_profiles || []
  const fatigueRows = perf?.creative_fatigue || []
  const fatigueMap = useMemo(() => new Map(fatigueRows.map(x => [x.creative_id, x])), [fatigueRows])
  const videoMap = useMemo(() => new Map((data?.video?.items || []).map(x => [x.creative_id, x])), [data?.video])
  const benchmark = Number(deep?.benchmarks?.avg_ctr || 0)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const enriched = useMemo(() => profiles.map(p => {
    const fatigue = fatigueMap.get(p.id)
    const state = creativeState(p, fatigue, benchmark)
    const video = videoMap.get(p.id)
    return { ...p, fatigue, state, video }
  }), [profiles, fatigueMap, videoMap, benchmark])

  const visible = enriched.filter(x => filter === 'all' ? true : filter === 'video' ? x.video?.available : x.state.key === filter)
  const winners = enriched.filter(x => x.state.key === 'winner').length
  const attention = enriched.filter(x => ['attention', 'postclick', 'fatigue'].includes(x.state.key)).length
  const spend = enriched.reduce((a, x) => a + Number(x.metrics?.spend || 0), 0)
  const purchases = enriched.reduce((a, x) => a + Number(x.metrics?.purchases || 0), 0)

  return <div className="page creatives-page">
    <PageHeader eyebrow="CRIATIVOS" title="Inteligência criativa da conta" description="Não basta saber qual anúncio vendeu. Aqui a análise separa atenção, eficiência, público, placement, fadiga e retenção de vídeo para entender por que uma peça funciona — ou onde ela quebra." />

    <div className="kpi-grid four">
      <KpiCard label="Criativos com entrega" value={integer(enriched.length)} note="Janela de 30 dias" />
      <KpiCard label="Sinais vencedores" value={integer(winners)} note="Compra + eficiência" accent />
      <KpiCard label="Precisam revisão" value={integer(attention)} note="Atenção, pós-clique ou fadiga" />
      <KpiCard label="Compras atribuídas" value={integer(purchases)} note={`${money(spend)} investidos`} />
    </div>

    <div className="tabs creative-tabs">
      {[['all', 'Todos'], ['winner', 'Vencedores'], ['promising', 'Promissores'], ['fatigue', 'Fadiga'], ['attention', 'Atenção'], ['postclick', 'Pós-clique'], ['video', 'Vídeos']].map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
    </div>

    <SectionHeader number="01" eyebrow="MAPA DE CRIATIVOS" title="Performance por peça" description="Cada card mostra o papel do criativo na conta. Clique para aprofundar audiência, placements e retenção." />
    <div className="creative-grid">
      {visible.map(item => {
        const m = item.metrics || {}
        return <article className="creative-card" key={item.id} onClick={() => setSelected(item)}>
          <div className="creative-media">{item.image_url || item.thumbnail_url ? <img src={item.image_url || item.thumbnail_url} alt="" loading="lazy" /> : <div className="creative-placeholder">SKIN</div>}<div className="creative-state"><Badge tone={item.state.tone}>{item.state.label}</Badge>{item.video?.available && <Badge tone="info">Vídeo</Badge>}</div></div>
          <div className="creative-body"><span className="creative-name">{item.name || 'Criativo sem nome'}</span><p>{item.headline || item.primary_text || item.hook || 'Sem headline estruturada.'}</p><div className="creative-metrics"><div><span>Gasto</span><strong>{money(m.spend)}</strong></div><div><span>ROAS</span><strong>{num(m.roas)}</strong></div><div><span>CTR</span><strong>{pct(m.ctr)}</strong></div><div><span>Compras</span><strong>{integer(m.purchases)}</strong></div></div>{item.fatigue && <div className="fatigue-bar"><span>Fadiga</span><div><i style={{ width: `${Math.min(100, Number(item.fatigue.fatigue_score || 0))}%` }} /></div><strong>{integer(item.fatigue.fatigue_score)}/100</strong></div>}</div>
        </article>
      })}
    </div>

    <SectionHeader number="02" eyebrow="COMPARAÇÃO" title="Tabela de eficiência criativa" description="Ordene mentalmente pela combinação de gasto, atenção, compra e retorno — nunca por um único indicador isolado." />
    <Surface><DataTable rows={enriched.slice(0, 50)} columns={[
      { key: 'name', label: 'Criativo', render: r => <div className="table-creative"><span className="table-thumb">{r.image_url || r.thumbnail_url ? <img src={r.image_url || r.thumbnail_url} alt="" /> : 'SB'}</span><div><strong>{r.name}</strong><small>{r.format || r.hook || '—'}</small></div></div> },
      { key: 'state', label: 'Leitura', render: r => <Badge tone={r.state.tone}>{r.state.label}</Badge> },
      { key: 'spend', label: 'Gasto', render: r => money(r.metrics?.spend) },
      { key: 'ctr', label: 'CTR', render: r => pct(r.metrics?.ctr) },
      { key: 'cpc', label: 'CPC', render: r => money(r.metrics?.cpc) },
      { key: 'purchases', label: 'Compras', render: r => integer(r.metrics?.purchases) },
      { key: 'cac', label: 'CAC', render: r => money(r.metrics?.cac) },
      { key: 'roas', label: 'ROAS', render: r => num(r.metrics?.roas) },
    ]} /></Surface>

    {selected && <div className="drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><aside className="creative-drawer"><div className="drawer-head"><div><Badge tone={selected.state.tone}>{selected.state.label}</Badge><h2>{selected.name}</h2><p>{selected.primary_text || selected.headline || selected.hook || 'Sem texto estruturado.'}</p></div><button onClick={() => setSelected(null)}>Fechar</button></div><div className="drawer-scroll">
      <div className="mini-metric-grid four"><MiniMetric label="Gasto" value={money(selected.metrics?.spend)} /><MiniMetric label="ROAS" value={num(selected.metrics?.roas)} /><MiniMetric label="CTR" value={pct(selected.metrics?.ctr)} /><MiniMetric label="Compras" value={integer(selected.metrics?.purchases)} /></div>
      {selected.video?.available && <Surface eyebrow="RETENÇÃO DE VÍDEO" title="Onde a audiência abandona"><div className="video-summary"><MiniMetric label="Plays" value={integer(selected.video.plays)} /><MiniMetric label="Play rate" value={pct(selected.video.play_rate_pct)} /><MiniMetric label="Tempo médio" value={`${num(selected.video.avg_watch_seconds,1)}s`} /><MiniMetric label="ThruPlay" value={pct(selected.video.thruplay_rate_pct)} /></div><RetentionChart retention={selected.video.retention_pct} /></Surface>}
      <Surface eyebrow="PÚBLICOS" title="Onde esse criativo entrega"><DataTable compact rows={(selected.audiences || []).slice(0, 12)} columns={[
        { key: 'ad_set_name', label: 'Conjunto' }, { key: 'audience_type', label: 'Público' }, { key: 'spend', label: 'Gasto', render: r => money(r.spend) }, { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
      <Surface eyebrow="PLACEMENTS" title="Onde esse criativo funciona"><DataTable compact rows={(selected.placements || []).slice(0, 12)} columns={[
        { key: 'publisher_platform', label: 'Plataforma' }, { key: 'platform_position', label: 'Posição' }, { key: 'spend', label: 'Gasto', render: r => money(r.spend) }, { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
      <Surface eyebrow="IDADE E GÊNERO" title="Quem responde melhor"><DataTable compact rows={(selected.ages || []).slice(0, 12)} columns={[
        { key: 'age', label: 'Idade' }, { key: 'gender', label: 'Gênero' }, { key: 'spend', label: 'Gasto', render: r => money(r.spend) }, { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
    </div></aside></div>}
  </div>
}
