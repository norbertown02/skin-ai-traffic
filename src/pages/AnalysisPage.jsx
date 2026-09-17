import React, { useMemo, useState } from 'react'
import { ChartCard, HorizontalBars } from '../components/Charts.jsx'
import { Badge, DataTable, KpiCard, MiniMetric, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct, rate } from '../lib/format.js'

function topRows(rows, metric = 'spend', limit = 8) {
  return (rows || []).slice().sort((a, b) => Number(b?.[metric] || 0) - Number(a?.[metric] || 0)).slice(0, limit)
}

function qualityTone(value) {
  if (value === 'Forte') return 'success'
  if (value === 'Promissor') return 'info'
  if (value === 'Sem compra' || value === 'Atenção') return 'danger'
  return 'neutral'
}

export default function AnalysisPage({ data }) {
  const main = data?.bootstrap?.main || {}
  const deep = data?.bootstrap?.deep || {}
  const performance = data?.bootstrap?.performance || {}
  const audience = data?.audience || {}
  const current30 = performance?.periods?.current30 || main?.cur?.k || {}
  const daily = performance?.daily || main?.daily || []
  const moving = performance?.moving_average_7d || []
  const [view, setView] = useState('overview')
  const labels = daily.map(x => String(x.date || '').slice(5))
  const crossAudience = deep?.cross?.creative_audience || []
  const crossAge = deep?.cross?.creative_age_set || []
  const crossPlacement = deep?.cross?.creative_placement_set || []
  const campaigns = main?.cur?.campaigns || []
  const sets = main?.cur?.sets || []
  const ads = main?.cur?.ads || []
  const byAge = audience?.by_age || []
  const byGender = audience?.by_gender || []

  const strongest = useMemo(() => topRows(crossAudience.filter(x => Number(x.purchases || 0) > 0), 'roas', 5), [crossAudience])
  const spendWithoutPurchase = useMemo(() => topRows(crossAudience.filter(x => Number(x.purchases || 0) === 0 && Number(x.spend || 0) > 0), 'spend', 5), [crossAudience])
  const topPlacements = useMemo(() => topRows(crossPlacement, 'spend', 10), [crossPlacement])
  const topAges = useMemo(() => topRows(crossAge, 'spend', 10), [crossAge])

  const tabs = [['overview', 'Visão geral'], ['audience', 'Público × criativo'], ['placement', 'Placement × criativo'], ['entities', 'Campanhas e conjuntos']]

  return <div className="page analysis-page">
    <PageHeader eyebrow="ANÁLISE DETALHADA" title="Onde a performance realmente muda" description="Cruza mídia, criativo, público, idade, gênero e placement para separar atenção, qualidade de tráfego e conversão. O objetivo aqui é explicar variação, não apenas listar métricas." />

    <div className="tabs analysis-tabs">{tabs.map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>)}</div>

    {view === 'overview' && <>
      <div className="kpi-grid six">
        <KpiCard label="Investimento · 30d" value={money(current30.spend)} note="Meta Ads" />
        <KpiCard label="ROAS Meta · 30d" value={num(current30.roas)} note="Receita atribuída" />
        <KpiCard label="CTR link · 30d" value={pct(current30.link_ctr || current30.ctr || 0)} note="Atenção" />
        <KpiCard label="CPC link · 30d" value={money(current30.link_cpc || current30.cpc || 0)} note="Custo de tráfego" />
        <KpiCard label="LPV rate · 30d" value={pct(current30.lpv_rate || 0)} note="Clique → página" />
        <KpiCard label="CAC Meta · 30d" value={money(current30.cost_purchase || current30.cac || 0)} note="Compra atribuída" />
      </div>

      <div className="analysis-diagnostic-strip">
        <div><span>ANOMALIA 7 DIAS</span><strong>{integer(performance?.anomaly?.score || 0)}/100</strong><small>Quanto maior, mais sinais deterioraram ao mesmo tempo.</small></div>
        {(performance?.anomaly?.items || []).slice(0, 6).map(item => <div key={item.label} className={item.direction === 'bad' ? 'bad' : item.direction === 'good' ? 'good' : ''}><span>{item.label}</span><strong>{item.change_pct == null ? '—' : `${item.change_pct >= 0 ? '+' : ''}${num(item.change_pct, 1)}%`}</strong><small>{item.direction === 'bad' ? 'Piorou' : item.direction === 'good' ? 'Melhorou' : 'Estável'}</small></div>)}
      </div>

      <SectionHeader number="01" eyebrow="TENDÊNCIA" title="Mídia recente em perspectiva" description="Acompanhe direção e volatilidade. A média móvel de 7 dias ajuda a não reagir a um único dia isolado." />
      <div className="chart-grid two">
        <ChartCard title="CPM × CPC" subtitle="Pressão do leilão e custo do tráfego" labels={labels} datasets={[{ label: 'CPM', data: daily.map(x => Number(x.cpm || 0)), borderColor: '#6d2f69', borderWidth: 3, tension: .35, pointRadius: 1 }, { label: 'CPC', data: daily.map(x => Number(x.link_cpc || x.cpc || 0)), borderColor: '#c49aaf', borderWidth: 2, tension: .35, pointRadius: 1 }]} />
        <ChartCard title="CTR × LPV rate" subtitle="Atenção e qualidade da chegada ao site" labels={labels} datasets={[{ label: 'CTR', data: daily.map(x => Number(x.link_ctr || x.ctr || 0)), borderColor: '#6d2f69', borderWidth: 3, tension: .35, pointRadius: 1 }, { label: 'LPV rate', data: daily.map(x => Number(x.lpv_rate || 0)), borderColor: '#a85d7c', borderWidth: 2, tension: .35, pointRadius: 1 }]} />
        <ChartCard title="ROAS × custo por compra" subtitle="Eficiência atribuída no fundo do funil" labels={labels} datasets={[{ label: 'ROAS', data: daily.map(x => Number(x.roas || 0)), borderColor: '#6d2f69', borderWidth: 3, tension: .35, pointRadius: 1 }, { label: 'Custo por compra', data: daily.map(x => Number(x.cost_purchase || 0)), borderColor: '#c49aaf', borderWidth: 2, tension: .35, pointRadius: 1 }]} />
        <ChartCard title="Média móvel 7d · CPM e CTR" subtitle="Leitura suavizada da direção dos indicadores" labels={moving.map(x => String(x.date || '').slice(5))} datasets={[{ label: 'CPM MA7', data: moving.map(x => Number(x.cpm || 0)), borderColor: '#2d1b2b', borderWidth: 3, tension: .35, pointRadius: 0 }, { label: 'CTR MA7', data: moving.map(x => Number(x.link_ctr || 0)), borderColor: '#a85d7c', borderWidth: 2, tension: .35, pointRadius: 0 }]} />
      </div>

      <SectionHeader number="02" eyebrow="BREAKDOWNS" title="Quem recebe a verba e onde ela entrega" description="Distribuição ajuda a enxergar concentração. Eficiência ajuda a decidir se a concentração faz sentido." />
      <div className="chart-grid two">
        <HorizontalBars title="Investimento por idade" subtitle="Últimos 30 dias" rows={byAge} valueKey="spend" formatValue={money} />
        <HorizontalBars title="Investimento por gênero" subtitle="Últimos 30 dias" rows={byGender} valueKey="spend" formatValue={money} />
      </div>

      <SectionHeader number="03" eyebrow="CRUZAMENTO" title="Sinais mais fortes e pontos sem compra" description="O mesmo criativo pode funcionar em um público e falhar em outro. Esse cruzamento reduz decisões genéricas sobre a peça ou sobre o público isoladamente." />
      <div className="grid-two">
        <Surface eyebrow="SINAIS POSITIVOS" title="Combinações com compra e ROAS">
          <DataTable compact rows={strongest} columns={[
            { key: 'creative_name', label: 'Criativo' },
            { key: 'ad_set_name', label: 'Conjunto' },
            { key: 'audience_type', label: 'Público', render: r => <Badge tone={qualityTone(r.status)}>{r.audience_type || '—'}</Badge> },
            { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
            { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
            { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
          ]} />
        </Surface>
        <Surface eyebrow="DESPERDÍCIO POTENCIAL" title="Combinações com gasto e zero compra">
          <DataTable compact rows={spendWithoutPurchase} columns={[
            { key: 'creative_name', label: 'Criativo' },
            { key: 'ad_set_name', label: 'Conjunto' },
            { key: 'audience_type', label: 'Público' },
            { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
            { key: 'clicks', label: 'Cliques', render: r => integer(r.clicks) },
            { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
          ]} />
        </Surface>
      </div>
    </>}

    {view === 'audience' && <>
      <SectionHeader number="01" eyebrow="PÚBLICO × CRIATIVO" title="O criativo certo para a audiência certa" description="O objetivo é descobrir se uma peça é fraca em geral ou apenas está sendo entregue para um segmento onde perde eficiência." />
      <Surface>
        <DataTable rows={topRows(crossAudience, 'spend', 40)} columns={[
          { key: 'creative_name', label: 'Criativo' },
          { key: 'ad_set_name', label: 'Conjunto' },
          { key: 'audience_type', label: 'Tipo' },
          { key: 'status', label: 'Leitura', render: r => <Badge tone={qualityTone(r.status)}>{r.status || '—'}</Badge> },
          { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
          { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
          { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
          { key: 'cac', label: 'CAC', render: r => money(r.cac) },
          { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
        ]} />
      </Surface>

      <SectionHeader number="02" eyebrow="IDADE E GÊNERO" title="Distribuição e eficiência demográfica" description="Veja onde o gasto está concentrado e quais combinações realmente retornam compra." />
      <Surface>
        <DataTable rows={topAges} columns={[
          { key: 'creative_name', label: 'Criativo' },
          { key: 'age', label: 'Idade' },
          { key: 'gender', label: 'Gênero' },
          { key: 'ad_set_name', label: 'Conjunto' },
          { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
          { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
          { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
          { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
        ]} />
      </Surface>
    </>}

    {view === 'placement' && <>
      <SectionHeader number="01" eyebrow="PLACEMENT × CRIATIVO" title="Onde cada peça funciona melhor" description="Facebook, Instagram e posições diferentes podem responder de forma muito distinta ao mesmo criativo." />
      <Surface>
        <DataTable rows={topPlacements} columns={[
          { key: 'creative_name', label: 'Criativo' },
          { key: 'publisher_platform', label: 'Plataforma' },
          { key: 'platform_position', label: 'Posição' },
          { key: 'ad_set_name', label: 'Conjunto' },
          { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
          { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
          { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
          { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
        ]} />
      </Surface>
    </>}

    {view === 'entities' && <>
      <SectionHeader number="01" eyebrow="CAMPANHAS" title="Escala e eficiência por campanha" description="Ordenado por gasto para enxergar rapidamente onde a conta está concentrada." />
      <Surface><DataTable rows={topRows(campaigns, 'spend', 30)} columns={[
        { key: 'name', label: 'Campanha' },
        { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
        { key: 'clicks', label: 'Cliques', render: r => integer(r.clicks) },
        { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
        { key: 'pur', label: 'Compras', render: r => integer(r.pur) },
        { key: 'cac', label: 'CAC', render: r => money(r.cac) },
        { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
      <SectionHeader number="02" eyebrow="CONJUNTOS" title="Leitura operacional por conjunto" description="Ajuda a separar problema de campanha de problema de público, otimização ou distribuição." />
      <Surface><DataTable rows={topRows(sets, 'spend', 40)} columns={[
        { key: 'name', label: 'Conjunto' },
        { key: 'optimization_goal', label: 'Otimização' },
        { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
        { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
        { key: 'pur', label: 'Compras', render: r => integer(r.pur) },
        { key: 'cac', label: 'CAC', render: r => money(r.cac) },
        { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
      <SectionHeader number="03" eyebrow="ANÚNCIOS" title="Anúncios com maior concentração de verba" description="Leitura rápida para abrir investigação de criativo, público ou pós-clique." />
      <Surface><DataTable rows={topRows(ads, 'spend', 40)} columns={[
        { key: 'name', label: 'Anúncio' },
        { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
        { key: 'clicks', label: 'Cliques', render: r => integer(r.clicks) },
        { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
        { key: 'pur', label: 'Compras', render: r => integer(r.pur) },
        { key: 'cac', label: 'CAC', render: r => money(r.cac) },
        { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
    </>}
  </div>
}
