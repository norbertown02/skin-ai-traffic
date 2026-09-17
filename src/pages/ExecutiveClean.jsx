import React, { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { delta, integer, money, monthLabel, num, pct, rate, shortMonth } from '../lib/format.js'

const PLUM = '#4b205f'
const PLUM_2 = '#77527f'
const LILAC = '#b8a4bd'
const INK = '#403344'
const SAND = '#d8d2cd'
const GREEN = '#657d70'

const d = (a, b) => delta(a, b)

function trend(change, inverse = false) {
  if (change === null || change === undefined || Number.isNaN(Number(change))) return null
  const value = Number(change)
  if (!value) return { text: '0%', tone: 'neutral' }
  const good = inverse ? value < 0 : value > 0
  return { text: `${value > 0 ? '+' : ''}${num(value, 1)}%`, tone: good ? 'good' : 'bad' }
}

function EditorialMetric({ label, value, change, inverse = false, caption }) {
  const t = trend(change, inverse)
  return <div className="deck-metric">
    <div className="deck-metric-label"><span>{label}</span>{t && <em className={t.tone}>{t.text}</em>}</div>
    <strong>{value}</strong>
    {caption && <small>{caption}</small>}
  </div>
}

function EditorialChart({ kicker, title, subtitle, labels, datasets, height = 280 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const hasSecondAxis = datasets.some(x => x.yAxisID === 'y1')
    const instance = new Chart(ref.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: datasets.length > 1,
            align: 'start',
            labels: { color: '#675b69', usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 18, font: { family: 'Montserrat', size: 11, weight: 500 } },
          },
          tooltip: { backgroundColor: '#4b205f', padding: 12, cornerRadius: 2, titleFont: { family: 'Montserrat', size: 11 }, bodyFont: { family: 'Montserrat', size: 11 } },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#948995', font: { family: 'Montserrat', size: 10 }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: 'rgba(75,32,95,.08)' }, border: { display: false }, ticks: { color: '#948995', font: { family: 'Montserrat', size: 10 }, maxTicksLimit: 5 } },
          ...(hasSecondAxis ? { y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, border: { display: false }, ticks: { color: '#948995', font: { family: 'Montserrat', size: 10 }, maxTicksLimit: 5 } } } : {}),
        },
      },
    })
    return () => instance.destroy()
  }, [JSON.stringify(labels), JSON.stringify(datasets)])

  return <article className="deck-chart">
    <div className="deck-chart-head"><span>{kicker}</span><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
    <div className="deck-chart-canvas" style={{ height }}><canvas ref={ref} /></div>
  </article>
}

function FunnelColumn({ title, source, rows }) {
  const max = Math.max(1, Number(rows?.[0]?.value || 0))
  return <div className="deck-funnel-column">
    <div className="deck-funnel-title"><span>{source}</span><h3>{title}</h3></div>
    <div className="deck-funnel-list">{rows.map((row, index) => {
      const value = Number(row.value || 0)
      const width = Math.max(value ? 5 : 0, Math.min(100, value / max * 100))
      return <div className="deck-funnel-row" key={row.label}>
        <div className="deck-funnel-copy"><span>{String(index + 1).padStart(2, '0')}</span><p>{row.label}</p><strong>{integer(value)}</strong></div>
        <div className="deck-funnel-track"><i style={{ width: `${width}%` }} /></div>
      </div>
    })}</div>
  </div>
}

function Chapter({ number, kicker, title, text, dark = false }) {
  return <div className={`deck-chapter ${dark ? 'dark' : ''}`}>
    <span className="deck-chapter-number">{number}</span>
    <div><small>{kicker}</small><h2>{title}</h2>{text && <p>{text}</p>}</div>
  </div>
}

export default function ExecutiveClean({ data }) {
  const business = data?.shopify?.business || []
  const funnels = data?.funnel?.months || []
  const [selected, setSelected] = useState(business.at(-1)?.month_start || '')
  const current = business.find(x => x.month_start === selected) || business.at(-1)
  if (!current) return <div className="empty-state">Sem dados consolidados para o relatório.</div>

  const index = business.findIndex(x => x.month_start === current.month_start)
  const previous = index > 0 ? business[index - 1] : null
  const funnelMap = useMemo(() => new Map(funnels.map(x => [x.month_start, x])), [funnels])
  const fm = funnelMap.get(current.month_start) || {}
  const pf = previous ? funnelMap.get(previous.month_start) || {} : {}
  const labels = business.map(x => shortMonth(x.month_start))

  const spend = Number(current.meta_spend || 0)
  const revenue = Number(current.shopify_revenue || 0)
  const orders = Number(current.shopify_orders || 0)
  const sessions = Number(current.sessions || 0)
  const aov = orders ? revenue / orders : 0
  const cac = orders ? spend / orders : 0
  const cvr = Number(current.conversion_rate || 0) * 100
  const prevCac = Number(previous?.shopify_orders || 0) ? Number(previous.meta_spend || 0) / Number(previous.shopify_orders || 0) : 0

  const revenueDelta = d(revenue, previous?.shopify_revenue)
  const weakest = [
    ['Clique → página', Number(fm.click_to_lpv || 0)],
    ['Página → carrinho', Number(fm.lpv_to_cart || 0)],
    ['Carrinho → checkout', Number(fm.cart_to_checkout || 0)],
    ['Checkout → compra', Number(fm.checkout_to_purchase || 0)],
  ].filter(x => x[1] > 0).sort((a, b) => a[1] - b[1])[0]

  const metaRows = [
    { label: 'Cliques no link', value: fm.link_clicks },
    { label: 'Visualizações da página', value: fm.landing_page_views },
    { label: 'Carrinhos', value: fm.adds_to_cart },
    { label: 'Checkout', value: fm.initiates_checkout },
    { label: 'Compras', value: fm.purchases },
  ]
  const shopRows = [
    { label: 'Sessões', value: sessions },
    { label: 'Carrinhos', value: current.cart_additions },
    { label: 'Checkout', value: current.reached_checkout },
    { label: 'Compras', value: current.completed_checkout || current.shopify_orders },
  ]

  return <div className="deck-report">
    <section className="deck-cover">
      <div className="deck-cover-top"><div className="deck-brand"><strong>Skin<br/>Beauty</strong><span>PERFORMANCE</span></div><span className="deck-year">2026</span></div>
      <div className="deck-cover-copy"><span>RELATÓRIO GERENCIAL</span><h1>Performance<br/>comercial</h1><p>Shopify, mídia e funil em uma leitura mensal objetiva da operação.</p></div>
      <label className="deck-period"><span>PERÍODO</span><select value={current.month_start} onChange={e => setSelected(e.target.value)}>{business.slice().reverse().map(x => <option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></label>
    </section>

    <section className="deck-page deck-overview">
      <div className="deck-overview-heading"><span>VISÃO DO MÊS</span><h2>{monthLabel(current.month_start)}</h2><p>O resultado comercial da Shopify é apresentado separado da atribuição da Meta.</p></div>
      <div className="deck-hero-number"><span>Receita Shopify</span><strong>{money(revenue)}</strong><p>{integer(orders)} pedidos &nbsp;·&nbsp; ticket médio {money(aov)} &nbsp;·&nbsp; conversão {pct(cvr)}</p></div>
      <div className="deck-metric-grid">
        <EditorialMetric label="Receita" value={money(revenue)} change={revenueDelta} />
        <EditorialMetric label="Pedidos" value={integer(orders)} change={d(orders, previous?.shopify_orders)} />
        <EditorialMetric label="Investimento Meta" value={money(spend)} change={d(spend, previous?.meta_spend)} inverse />
        <EditorialMetric label="CAC blended" value={money(cac)} change={d(cac, prevCac)} inverse />
        <EditorialMetric label="MER" value={num(current.mer)} change={d(current.mer, previous?.mer)} />
        <EditorialMetric label="Conversão" value={pct(cvr)} change={d(current.conversion_rate, previous?.conversion_rate)} />
      </div>
    </section>

    <section className="deck-statement">
      <span>LEITURA DO PERÍODO</span>
      <h2>{previous ? `A receita ${Number(revenueDelta) >= 0 ? 'avançou' : 'recuou'} ${num(Math.abs(Number(revenueDelta || 0)), 1)}% em relação a ${monthLabel(previous.month_start)}.` : 'Este é o primeiro período comparável disponível.'}</h2>
      <div className="deck-statement-grid">
        <div><span>FUNIL</span><p>{weakest ? `${weakest[0]} é hoje a menor taxa de passagem, com ${pct(weakest[1])}.` : 'Ainda não há eventos suficientes para identificar um gargalo consistente.'}</p></div>
        <div><span>MÍDIA</span><p>CPM {money(fm.cpm)}, CPC {money(fm.cpc)}, CTR {pct(fm.ctr)} e frequência {num(fm.frequency)} no período selecionado.</p></div>
      </div>
    </section>

    <section className="deck-page">
      <Chapter number="01" kicker="NEGÓCIO" title="Crescimento e eficiência" text="Uma leitura de escala, custo de aquisição e retorno, mês a mês." />
      <EditorialChart kicker="EVOLUÇÃO MENSAL" title="Receita e investimento" subtitle="Receita real da Shopify versus investimento em mídia" labels={labels} height={360} datasets={[
        { type: 'bar', label: 'Receita', data: business.map(x => Number(x.shopify_revenue || 0)), backgroundColor: 'rgba(75,32,95,.12)', borderColor: PLUM, borderWidth: 1, borderRadius: 2 },
        { type: 'line', label: 'Investimento', data: business.map(x => Number(x.meta_spend || 0)), borderColor: PLUM_2, borderWidth: 2.2, pointRadius: 2, tension: .25 },
      ]} />
      <div className="deck-two-columns">
        <EditorialChart kicker="AQUISIÇÃO" title="Pedidos e CAC" subtitle="Volume de pedidos comparado ao custo blended de aquisição" labels={labels} datasets={[
          { type: 'bar', label: 'Pedidos', data: business.map(x => Number(x.shopify_orders || 0)), backgroundColor: 'rgba(64,51,68,.10)', borderColor: INK, borderWidth: 1, borderRadius: 2 },
          { type: 'line', label: 'CAC', yAxisID: 'y1', data: business.map(x => Number(x.shopify_orders || 0) ? Number(x.meta_spend || 0) / Number(x.shopify_orders || 0) : 0), borderColor: PLUM, borderWidth: 2, pointRadius: 2, tension: .25 },
        ]} />
        <EditorialChart kicker="RETORNO" title="MER e ROAS Meta" subtitle="Eficiência real da operação versus atribuição da plataforma" labels={labels} datasets={[
          { label: 'MER', data: business.map(x => Number(x.mer || 0)), borderColor: PLUM, borderWidth: 2.2, pointRadius: 2, tension: .25 },
          { label: 'ROAS Meta', data: business.map(x => Number(x.meta_roas || 0)), borderColor: LILAC, borderWidth: 2.2, pointRadius: 2, tension: .25 },
        ]} />
      </div>
    </section>

    <section className="deck-purple-page">
      <Chapter number="02" kicker="FUNIL" title="Do clique à compra" text="Atribuição da Meta e comportamento real da loja apresentados como duas leituras complementares." dark />
      <div className="deck-funnels">
        <FunnelColumn source="META ADS" title="Funil atribuído" rows={metaRows} />
        <FunnelColumn source="SHOPIFY" title="Funil da loja" rows={shopRows} />
      </div>
      <div className="deck-rate-strip">
        <div><span>Clique → página</span><strong>{pct(fm.click_to_lpv)}</strong></div>
        <div><span>Página → carrinho</span><strong>{pct(fm.lpv_to_cart)}</strong></div>
        <div><span>Sessão → carrinho</span><strong>{pct(rate(current.cart_additions, current.sessions))}</strong></div>
        <div><span>Sessão → compra</span><strong>{pct(rate(current.completed_checkout || current.shopify_orders, current.sessions))}</strong></div>
      </div>
    </section>

    <section className="deck-page">
      <Chapter number="03" kicker="MÍDIA" title="Eficiência de entrega" text="CPM, CPC, CTR e frequência vistos como comportamento de mídia ao longo do tempo." />
      <div className="deck-delivery-grid">
        <EditorialMetric label="CPM" value={money(fm.cpm)} change={d(fm.cpm, pf.cpm)} inverse />
        <EditorialMetric label="CPC" value={money(fm.cpc)} change={d(fm.cpc, pf.cpc)} inverse />
        <EditorialMetric label="CTR" value={pct(fm.ctr)} change={d(fm.ctr, pf.ctr)} />
        <EditorialMetric label="Frequência" value={num(fm.frequency)} change={d(fm.frequency, pf.frequency)} />
      </div>
      <div className="deck-two-columns">
        <EditorialChart kicker="LEILÃO" title="CPM" subtitle="Custo por mil impressões" labels={labels} datasets={[{ label: 'CPM', data: business.map(x => funnelMap.get(x.month_start)?.cpm || 0), borderColor: PLUM, borderWidth: 2.2, pointRadius: 2, tension: .25 }]} />
        <EditorialChart kicker="TRÁFEGO" title="CPC" subtitle="Custo por clique" labels={labels} datasets={[{ label: 'CPC', data: business.map(x => funnelMap.get(x.month_start)?.cpc || 0), borderColor: PLUM_2, borderWidth: 2.2, pointRadius: 2, tension: .25 }]} />
        <EditorialChart kicker="ATENÇÃO" title="CTR" subtitle="Taxa de clique" labels={labels} datasets={[{ label: 'CTR', data: business.map(x => funnelMap.get(x.month_start)?.ctr || 0), borderColor: GREEN, borderWidth: 2.2, pointRadius: 2, tension: .25 }]} />
        <EditorialChart kicker="PRESSÃO" title="Frequência" subtitle="Repetição média de exposição" labels={labels} datasets={[{ label: 'Frequência', data: business.map(x => funnelMap.get(x.month_start)?.frequency || 0), borderColor: INK, borderWidth: 2.2, pointRadius: 2, tension: .25 }]} />
      </div>
    </section>

    <section className="deck-end"><span>SKIN BEAUTY · PERFORMANCE</span><h2>No flow<br/>dos seus dados.</h2><p>Relatório gerencial · {monthLabel(current.month_start)}</p></section>
  </div>
}
