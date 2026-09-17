import React, { useMemo } from 'react'
import { HorizontalBars } from '../components/Charts.jsx'
import { Badge, DataTable, Insight, KpiCard, MiniMetric, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'

function sortBy(rows, key = 'spend', limit = 50) {
  return (rows || []).slice().sort((a, b) => Number(b?.[key] || 0) - Number(a?.[key] || 0)).slice(0, limit)
}

export function AudiencesPage({ data }) {
  const audience = data?.audience || {}
  const main = data?.bootstrap?.main || {}
  const rows = main?.audienceRows || []
  const summary = main?.audienceSummary || {}
  const total = audience?.total || {}
  const byAge = audience?.by_age || []
  const byGender = audience?.by_gender || []
  const combos = audience?.age_gender || []
  const types = summary?.by_type || []
  const overlaps = summary?.overlaps || []

  return <div className="page audiences-page">
    <PageHeader eyebrow="PÚBLICOS" title="Estratégia e eficiência de audiência" description="Amplitude, remarketing, interesses, lookalikes e Advantage precisam ser comparados por custo, atenção e compra — não apenas por tamanho de público." />
    <div className="kpi-grid five">
      <KpiCard label="Investimento · 30d" value={money(total.spend)} />
      <KpiCard label="Compras atribuídas" value={integer(total.purchases)} />
      <KpiCard label="ROAS" value={num(total.roas)} />
      <KpiCard label="CAC" value={money(total.cac)} />
      <KpiCard label="CTR" value={pct(total.ctr)} />
    </div>

    <SectionHeader number="01" eyebrow="DEMOGRAFIA" title="Onde a verba está concentrada" description="Participação de gasto é útil, mas só ganha contexto quando comparada a participação de compra e eficiência." />
    <div className="chart-grid two">
      <HorizontalBars title="Gasto por idade" subtitle="Meta · últimos 30 dias" rows={byAge} valueKey="spend" formatValue={money} />
      <HorizontalBars title="Compras por idade" subtitle="Meta · últimos 30 dias" rows={byAge} valueKey="purchases" formatValue={integer} />
    </div>
    <div className="grid-two">
      <Surface eyebrow="GÊNERO" title="Distribuição e retorno"><DataTable compact rows={byGender} columns={[
        { key: 'key', label: 'Gênero' }, { key: 'spend_share', label: '% gasto', render: r => pct(r.spend_share) }, { key: 'purchase_share', label: '% compras', render: r => pct(r.purchase_share) }, { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) }, { key: 'cac', label: 'CAC', render: r => money(r.cac) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
      <Surface eyebrow="IDADE × GÊNERO" title="Combinações com mais gasto"><DataTable compact rows={sortBy(combos, 'spend', 12)} columns={[
        { key: 'key', label: 'Segmento' }, { key: 'spend', label: 'Gasto', render: r => money(r.spend) }, { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) }, { key: 'cac', label: 'CAC', render: r => money(r.cac) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
      ]} /></Surface>
    </div>

    <SectionHeader number="02" eyebrow="ESTRATÉGIA" title="Tipos de público" description="Compare estratégia de audiência em blocos equivalentes antes de concluir que um tipo de público é superior por si só." />
    <Surface><DataTable rows={types} columns={[
      { key: 'key', label: 'Estratégia', render: r => <Badge tone={r.key === 'remarketing' ? 'info' : 'neutral'}>{r.key || '—'}</Badge> },
      { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
      { key: 'impressions', label: 'Impressões', render: r => integer(r.impressions) },
      { key: 'clicks', label: 'Cliques', render: r => integer(r.clicks) },
      { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
      { key: 'cac', label: 'CAC', render: r => money(r.cac) },
      { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
    ]} /></Surface>

    <SectionHeader number="03" eyebrow="SOBREPOSIÇÃO" title="Possível competição entre públicos" description="Sobreposição não significa automaticamente erro, mas pode fragmentar aprendizado e elevar custo se dois conjuntos cumprem a mesma função." />
    <div className="overlap-grid">{overlaps.length ? overlaps.slice(0, 8).map((x, i) => <Insight key={i} label={`SCORE ${integer(x.score)}`} title={`${x.a_name} × ${x.b_name}`} text={`${x.common_custom?.length || 0} audiências personalizadas em comum · gasto combinado ${money(x.combined_spend)}`} tone={x.score >= 8 ? 'warning' : 'neutral'} />) : <Surface><p className="muted-copy">Nenhuma sobreposição relevante detectada no recorte atual.</p></Surface>}</div>

    <SectionHeader number="04" eyebrow="CONFIGURAÇÃO" title="Conjuntos e targeting ativo" description="Leitura operacional do que está sendo usado hoje: tipo de audiência, Advantage, idade, gênero, geografia e eficiência." />
    <Surface><DataTable rows={sortBy(rows, 'spend', 40)} columns={[
      { key: 'name', label: 'Conjunto' },
      { key: 'type', label: 'Tipo', render: r => <Badge>{r.type}</Badge> },
      { key: 'advantage', label: 'Advantage', render: r => r.advantage ? <Badge tone="info">Ativo</Badge> : <Badge>Manual</Badge> },
      { key: 'age', label: 'Idade' }, { key: 'gender', label: 'Gênero' },
      { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
      { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
      { key: 'cac', label: 'CAC', render: r => money(r.cac) },
      { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
    ]} /></Surface>
  </div>
}

export function PlacementsPage({ data }) {
  const cross = data?.bootstrap?.deep?.cross?.creative_placement_set || []
  const platforms = data?.bootstrap?.main?.cur?.delivery_intelligence?.platforms || []
  const aggregated = useMemo(() => {
    const map = new Map()
    for (const row of cross) {
      const key = `${row.publisher_platform || 'unknown'} · ${row.platform_position || 'unknown'}`
      const x = map.get(key) || { key, publisher_platform: row.publisher_platform, platform_position: row.platform_position, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 }
      x.spend += Number(row.spend || 0); x.impressions += Number(row.impressions || 0); x.clicks += Number(row.clicks || 0); x.purchases += Number(row.purchases || 0); x.revenue += Number(row.revenue || 0)
      map.set(key, x)
    }
    return [...map.values()].map(x => ({ ...x, ctr: x.impressions ? x.clicks / x.impressions * 100 : 0, cpm: x.impressions ? x.spend / x.impressions * 1000 : 0, cpc: x.clicks ? x.spend / x.clicks : 0, cac: x.purchases ? x.spend / x.purchases : 0, roas: x.spend ? x.revenue / x.spend : 0 })).sort((a, b) => b.spend - a.spend)
  }, [cross])
  const totalSpend = aggregated.reduce((a, x) => a + x.spend, 0)
  const totalPurchases = aggregated.reduce((a, x) => a + x.purchases, 0)

  return <div className="page placements-page">
    <PageHeader eyebrow="PLACEMENTS" title="Onde a mídia realmente entrega" description="Plataforma e posição podem alterar CPM, CTR, conversão e qualidade do tráfego. A análise precisa olhar placement junto com criativo e conjunto." />
    <div className="kpi-grid four"><KpiCard label="Gasto mapeado" value={money(totalSpend)} /><KpiCard label="Compras mapeadas" value={integer(totalPurchases)} /><KpiCard label="Placements ativos" value={integer(aggregated.length)} /><KpiCard label="Criativos cruzados" value={integer(new Set(cross.map(x => x.creative_id)).size)} /></div>
    <SectionHeader number="01" eyebrow="PLATAFORMAS" title="Facebook × Instagram" description="Visão consolidada quando a origem está disponível no bootstrap da conta." />
    <Surface><DataTable rows={platforms} columns={[
      { key: 'publisher_platform', label: 'Plataforma' },
      { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
      { key: 'impressions', label: 'Impressões', render: r => integer(r.impressions) },
      { key: 'clicks', label: 'Cliques', render: r => integer(r.clicks) },
      { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) },
      { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
    ]} /></Surface>
    <SectionHeader number="02" eyebrow="POSIÇÕES" title="Eficiência por placement" description="Feed, Stories, Reels, Explore e demais posições são comparados pela entrega observada." />
    <Surface><DataTable rows={aggregated} columns={[
      { key: 'publisher_platform', label: 'Plataforma' }, { key: 'platform_position', label: 'Posição' },
      { key: 'spend', label: 'Gasto', render: r => money(r.spend) }, { key: 'cpm', label: 'CPM', render: r => money(r.cpm) }, { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) }, { key: 'cpc', label: 'CPC', render: r => money(r.cpc) }, { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) }, { key: 'cac', label: 'CAC', render: r => money(r.cac) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
    ]} /></Surface>
    <SectionHeader number="03" eyebrow="CRIATIVO × PLACEMENT" title="Onde cada peça ganha ou perde" description="Esse é o cruzamento mais útil para decidir se o problema é a peça ou a posição onde ela está sendo entregue." />
    <Surface><DataTable rows={sortBy(cross, 'spend', 50)} columns={[
      { key: 'creative_name', label: 'Criativo' }, { key: 'publisher_platform', label: 'Plataforma' }, { key: 'platform_position', label: 'Posição' }, { key: 'ad_set_name', label: 'Conjunto' }, { key: 'spend', label: 'Gasto', render: r => money(r.spend) }, { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) }, { key: 'purchases', label: 'Compras', render: r => integer(r.purchases) }, { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
    ]} /></Surface>
  </div>
}

export function EntityPage({ data, type }) {
  const main = data?.bootstrap?.main || {}
  const config = {
    campaign: { eyebrow: 'CAMPANHAS', title: 'Saúde e eficiência das campanhas', rows: main?.cur?.campaigns || [], subtitle: 'A leitura de campanha serve para alocação macro de orçamento e tendência. Diagnóstico fino deve descer para conjunto, anúncio e criativo.' },
    ad_set: { eyebrow: 'CONJUNTOS', title: 'Leitura operacional dos conjuntos', rows: main?.cur?.sets || [], subtitle: 'Público, otimização, placement e distribuição de verba ficam mais claros no nível de conjunto.' },
    ad: { eyebrow: 'ANÚNCIOS', title: 'Performance dos anúncios', rows: main?.cur?.ads || [], subtitle: 'Use esta visão para encontrar concentração de gasto e abrir investigação no criativo correspondente.' },
  }[type]
  const rows = sortBy(config.rows, 'spend', 80)
  const spend = rows.reduce((a, x) => a + Number(x.spend || 0), 0)
  const purchases = rows.reduce((a, x) => a + Number(x.pur || x.purchases || 0), 0)
  const revenue = rows.reduce((a, x) => a + Number(x.rev || x.revenue || 0), 0)
  const roas = spend ? revenue / spend : 0
  return <div className="page entity-page"><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.subtitle} />
    <div className="kpi-grid four"><KpiCard label="Investimento" value={money(spend)} /><KpiCard label="Compras atribuídas" value={integer(purchases)} /><KpiCard label="ROAS agregado" value={num(roas)} /><KpiCard label="Itens com entrega" value={integer(rows.length)} /></div>
    <SectionHeader number="01" eyebrow="PERFORMANCE" title="Ordenado por concentração de gasto" description="Use gasto como porta de entrada e eficiência como critério de decisão." />
    <Surface><DataTable rows={rows} columns={[
      { key: 'name', label: type === 'campaign' ? 'Campanha' : type === 'ad_set' ? 'Conjunto' : 'Anúncio' },
      ...(type === 'ad_set' ? [{ key: 'optimization_goal', label: 'Otimização' }] : []),
      { key: 'spend', label: 'Gasto', render: r => money(r.spend) },
      { key: 'impressions', label: 'Impressões', render: r => integer(r.imp || r.impressions) },
      { key: 'clicks', label: 'Cliques', render: r => integer(r.clicks) },
      { key: 'ctr', label: 'CTR', render: r => pct(r.ctr) },
      { key: 'cpc', label: 'CPC', render: r => money(r.cpc) },
      { key: 'pur', label: 'Compras', render: r => integer(r.pur || r.purchases) },
      { key: 'cac', label: 'CAC', render: r => money(r.cac) },
      { key: 'roas', label: 'ROAS', render: r => num(r.roas) },
    ]} /></Surface>
  </div>
}

export function WastePage({ data }) {
  const waste = data?.bootstrap?.deep?.waste || {}
  const items = waste?.items || []
  const summary = waste?.summary || {}
  const groups = summary?.counts || {}
  return <div className="page waste-page"><PageHeader eyebrow="DESPERDÍCIOS" title="Onde a verba pode estar sendo perdida" description="A ferramenta não chama todo gasto sem compra de desperdício automaticamente. Ela separa baixa atenção, pós-clique, mismatch de audiência e mismatch de placement para sugerir a investigação correta." />
    <div className="kpi-grid five"><KpiCard label="Desperdício potencial" value={money(summary.estimated_total)} accent /><KpiCard label="Sem sinal de fundo" value={integer(groups.absolute || 0)} /><KpiCard label="Atenção fraca" value={integer(groups.attention || 0)} /><KpiCard label="Pós-clique" value={integer(groups.post_click || 0)} /><KpiCard label="Mismatch público/placement" value={integer((groups.audience_mismatch || 0) + (groups.placement_mismatch || 0))} /></div>
    <SectionHeader number="01" eyebrow="DIAGNÓSTICOS" title="Casos priorizados" description="Cada linha indica o tipo de problema provável e qual investigação é mais adequada antes de pausar mídia." />
    <div className="waste-list">{items.map((x, i) => <Surface key={i} className="waste-item"><div className="waste-head"><div><Badge tone={x.severity === 'high' ? 'danger' : 'warning'}>{x.type?.replaceAll('_', ' ')}</Badge><h3>{x.creative_name || x.ad_name || x.name || 'Diagnóstico de desperdício'}</h3></div><strong>{money(x.estimated_waste || x.spend)}</strong></div><p>{x.reason}</p><div className="waste-action"><span>PRÓXIMA AÇÃO</span><strong>{x.action}</strong></div></Surface>)}</div>
  </div>
}

export function IntegrationsPage({ data }) {
  const source = data?.bootstrap?.main?.period?.end || data?.bootstrap?.main?.daily?.at?.(-1)?.date
  const shopMonth = data?.shopify?.business?.at?.(-1)?.month_start
  const managerRun = data?.manager?.runs?.[0]?.started_at
  return <div className="page integrations-page"><PageHeader eyebrow="INTEGRAÇÕES" title="Fontes de dados e saúde operacional" description="O painel separa claramente qual sistema é a fonte de verdade para cada tipo de informação." />
    <div className="integration-grid">
      <Surface className="integration-card"><div className="integration-logo meta-logo">M</div><Badge tone="warning">Histórico</Badge><h3>Meta Ads</h3><p>Fonte de mídia: gasto, alcance, impressões, cliques, CPM, CPC, CTR, frequência, breakdowns e atribuição.</p><div className="integration-detail"><span>Último dado disponível</span><strong>{source || '—'}</strong></div></Surface>
      <Surface className="integration-card"><div className="integration-logo shop-logo">S</div><Badge tone="success">Conectado</Badge><h3>Shopify</h3><p>Fonte comercial: receita real, pedidos, sessões, carrinhos, checkout e conversão do site.</p><div className="integration-detail"><span>Último mês consolidado</span><strong>{shopMonth || '—'}</strong></div></Surface>
      <Surface className="integration-card"><div className="integration-logo ai-logo">AI</div><Badge tone="info">Ativo</Badge><h3>Gestor IA</h3><p>Camada de decisão contínua com observações, hipóteses, experimentos, aprendizados e aprovações.</p><div className="integration-detail"><span>Última execução</span><strong>{managerRun ? new Date(managerRun).toLocaleString('pt-BR') : '—'}</strong></div></Surface>
    </div>
    <SectionHeader number="01" eyebrow="REGRAS DE VERDADE" title="Como o painel interpreta os dados" description="Evita comparar métricas de plataformas diferentes como se fossem a mesma coisa." />
    <div className="grid-two"><Insight label="SHOPIFY" title="Receita e pedidos reais" text="MER, receita, pedidos, ticket, sessões e conversão usam o consolidado da Shopify como fonte comercial." tone="positive" /><Insight label="META" title="Mídia e atribuição" text="ROAS Meta, CPM, CPC, CTR, frequência, breakdowns e funil atribuído usam os dados do Meta Ads." /></div>
  </div>
}
