import React, { useMemo, useState } from 'react'
import { ChartCard } from '../components/Charts.jsx'
import { Funnel, Insight, KpiCard, MiniMetric, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { delta, deltaText, integer, money, monthLabel, num, pct, rate, shortMonth, sourceDate } from '../lib/format.js'

const plum = '#6d2f69'
const blush = '#c49aaf'
const ink = '#2d1b2b'
const rose = '#a85d7c'

function bottleneck(fm) {
  const rows = [
    ['Clique → página', Number(fm?.click_to_lpv || 0)],
    ['Página → carrinho', Number(fm?.lpv_to_cart || 0)],
    ['Carrinho → checkout', Number(fm?.cart_to_checkout || 0)],
    ['Checkout → compra', Number(fm?.checkout_to_purchase || 0)],
  ].filter(x => x[1] > 0)
  return rows.sort((a, b) => a[1] - b[1])[0] || null
}

function deliveryRead(current, previous) {
  if (!current) return { title: 'Sem leitura suficiente', text: 'Ainda não há dados de entrega suficientes para comparar o mês.' }
  const cpm = delta(current.cpm, previous?.cpm)
  const cpc = delta(current.cpc, previous?.cpc)
  const ctr = delta(current.ctr, previous?.ctr)
  if (cpm !== null && cpm > 15 && ctr !== null && ctr < -10) return { title: 'Leilão mais caro e atenção pior', text: `CPM subiu ${num(Math.abs(cpm), 1)}% enquanto o CTR caiu ${num(Math.abs(ctr), 1)}%. O custo de tráfego está sofrendo dos dois lados.` }
  if (cpc !== null && cpc > 15 && ctr !== null && ctr >= 0) return { title: 'Clique mais caro sem perda de atenção', text: `O CTR não piorou, mas o CPC subiu ${num(cpc, 1)}%. O leilão/CPM merece mais atenção do que o criativo isoladamente.` }
  if (ctr !== null && ctr > 10) return { title: 'Sinal positivo de atenção', text: `CTR melhorou ${num(ctr, 1)}% contra o mês anterior. Vale investigar quais criativos e placements puxaram essa melhora.` }
  return { title: 'Entrega relativamente estável', text: 'Os principais indicadores de mídia não mostram uma mudança extrema frente ao mês anterior.' }
}

function commerceRead(current, previous) {
  if (!current || !previous) return { title: 'Sem base comparável', text: 'A leitura comercial ganha força quando existe um mês anterior completo para comparação.' }
  const revenue = delta(current.shopify_revenue, previous.shopify_revenue)
  const orders = delta(current.shopify_orders, previous.shopify_orders)
  const mer = delta(current.mer, previous.mer)
  if (revenue !== null && revenue > 10 && mer !== null && mer > 10) return { title: 'Crescimento com eficiência', text: `Receita cresceu ${num(revenue, 1)}% e MER melhorou ${num(mer, 1)}%. É um sinal melhor que crescimento sustentado apenas por mais verba.` }
  if (revenue !== null && revenue < -10 && orders !== null && orders < -10) return { title: 'Queda comercial relevante', text: `Receita caiu ${num(Math.abs(revenue), 1)}% e pedidos caíram ${num(Math.abs(orders), 1)}%. A análise precisa separar tráfego, conversão e ticket.` }
  if (mer !== null && mer < -15) return { title: 'Eficiência comercial deteriorou', text: `MER caiu ${num(Math.abs(mer), 1)}%. A mídia está gerando menos receita real da Shopify por real investido.` }
  return { title: 'Resultado sem ruptura clara', text: 'O mês não mostra uma ruptura extrema entre investimento e resultado comercial na comparação disponível.' }
}

export default function ExecutivePage({ data }) {
  const business = data?.shopify?.business || []
  const funnelMonths = data?.funnel?.months || []
  const performance = data?.bootstrap?.performance || {}
  const [selected, setSelected] = useState(business.at(-1)?.month_start || '')
  const current = business.find(x => x.month_start === selected) || business.at(-1)
  const currentIndex = business.findIndex(x => x.month_start === current?.month_start)
  const previous = currentIndex > 0 ? business[currentIndex - 1] : null
  const fMap = useMemo(() => new Map(funnelMonths.map(x => [x.month_start, x])), [funnelMonths])
  const fm = fMap.get(current?.month_start) || {}
  const previousFunnel = fMap.get(previous?.month_start) || {}
  if (!current) return <div className="empty-state"><p>Sem dados consolidados para montar o relatório gerencial.</p></div>

  const labels = business.map(x => shortMonth(x.month_start))
  const blendedCac = Number(current.shopify_orders || 0) ? Number(current.meta_spend || 0) / Number(current.shopify_orders || 0) : 0
  const previousBlendedCac = Number(previous?.shopify_orders || 0) ? Number(previous.meta_spend || 0) / Number(previous.shopify_orders || 0) : 0
  const aov = Number(current.shopify_orders || 0) ? Number(current.shopify_revenue || 0) / Number(current.shopify_orders || 0) : 0
  const previousAov = Number(previous?.shopify_orders || 0) ? Number(previous.shopify_revenue || 0) / Number(previous.shopify_orders || 0) : 0
  const shopifyPurchaseRate = rate(current.completed_checkout || current.shopify_orders, current.sessions)
  const metaBottleneck = bottleneck(fm)
  const delivery = deliveryRead(fm, previousFunnel)
  const commerce = commerceRead(current, previous)
  const source = sourceDate(data)

  const metaFunnel = [
    { label: 'Cliques no link', value: fm.link_clicks },
    { label: 'Visualizações da página', value: fm.landing_page_views },
    { label: 'Carrinhos', value: fm.adds_to_cart },
    { label: 'Checkout', value: fm.initiates_checkout },
    { label: 'Compras', value: fm.purchases },
  ]
  const shopifyFunnel = [
    { label: 'Sessões', value: current.sessions },
    { label: 'Carrinhos', value: current.cart_additions },
    { label: 'Checkout', value: current.reached_checkout },
    { label: 'Compras', value: current.completed_checkout || current.shopify_orders },
  ]

  return <div className="page executive-page">
    <PageHeader
      eyebrow="RELATÓRIO GERENCIAL"
      title="Performance executiva da operação"
      description="Mídia, comportamento e resultado comercial em uma única leitura. Shopify é a verdade de receita e pedidos; Meta é a verdade de entrega e atribuição de mídia."
      meta={source ? <>Meta com histórico disponível até <strong>{new Date(`${source}T12:00:00`).toLocaleDateString('pt-BR')}</strong></> : null}
      actions={<div className="month-picker"><span>Mês analisado</span><select value={current.month_start} onChange={e => setSelected(e.target.value)}>{business.slice().reverse().map(x => <option key={x.month_start} value={x.month_start}>{monthLabel(x.month_start)}</option>)}</select></div>}
    />

    <section className="executive-hero">
      <div className="executive-hero-main"><span>Receita real Shopify</span><strong>{money(current.shopify_revenue)}</strong><div className="executive-hero-tags"><span>{integer(current.shopify_orders)} pedidos</span><span>Ticket {money(aov)}</span><span>Conversão {pct(Number(current.conversion_rate || 0) * 100)}</span></div></div>
      <div className="executive-hero-spend"><span>Investimento Meta</span><strong>{money(current.meta_spend)}</strong><small>MER {num(current.mer)} · ROAS atribuído {num(current.meta_roas)}</small></div>
      <div className="executive-hero-note"><span>LEITURA PRIORITÁRIA</span><h3>{metaBottleneck ? metaBottleneck[0] : 'Funil em leitura'}</h3><p>{metaBottleneck ? `É a etapa com menor taxa de passagem no funil Meta: ${pct(metaBottleneck[1])}.` : 'Ainda não há todos os eventos necessários para apontar um gargalo.'}</p></div>
    </section>

    <div className="kpi-grid eight">
      <KpiCard label="Receita Shopify" value={money(current.shopify_revenue)} current={current.shopify_revenue} previous={previous?.shopify_revenue} accent />
      <KpiCard label="Investimento Meta" value={money(current.meta_spend)} current={current.meta_spend} previous={previous?.meta_spend} inverse />
      <KpiCard label="Pedidos" value={integer(current.shopify_orders)} current={current.shopify_orders} previous={previous?.shopify_orders} />
      <KpiCard label="MER" value={num(current.mer)} current={current.mer} previous={previous?.mer} />
      <KpiCard label="CAC blended" value={money(blendedCac)} current={blendedCac} previous={previousBlendedCac} inverse />
      <KpiCard label="Ticket médio" value={money(aov)} current={aov} previous={previousAov} />
      <KpiCard label="Conversão site" value={pct(Number(current.conversion_rate || 0) * 100)} current={current.conversion_rate} previous={previous?.conversion_rate} />
      <KpiCard label="ROAS Meta" value={num(current.meta_roas)} current={current.meta_roas} previous={previous?.meta_roas} />
    </div>

    <div className="executive-insights">
      <Insight label="FUNIL" title={metaBottleneck?.[0] || 'Sem gargalo definido'} text={metaBottleneck ? `Taxa de passagem de ${pct(metaBottleneck[1])}. Investigue essa etapa antes de mudar toda a operação.` : 'Os dados ainda não permitem definir um gargalo com segurança.'} tone="warning" />
      <Insight label="ENTREGA" title={delivery.title} text={delivery.text} />
      <Insight label="NEGÓCIO" title={commerce.title} text={commerce.text} tone="positive" />
    </div>

    <SectionHeader number="01" eyebrow="NEGÓCIO" title="Receita, investimento e eficiência" description="A visão que importa para gestão: quanto entrou, quanto foi investido e com que eficiência o negócio converteu mídia em receita real." />
    <div className="chart-grid two">
      <ChartCard title="Receita Shopify × investimento Meta" subtitle="Comparação mensal de escala comercial e mídia" labels={labels} datasets={[
        { type: 'bar', label: 'Receita Shopify', data: business.map(x => Number(x.shopify_revenue || 0)), backgroundColor: 'rgba(109,47,105,.18)', borderColor: plum, borderWidth: 1, borderRadius: 8 },
        { type: 'line', label: 'Investimento Meta', data: business.map(x => Number(x.meta_spend || 0)), borderColor: rose, backgroundColor: rose, borderWidth: 3, tension: .35, pointRadius: 3 },
      ]} />
      <ChartCard title="MER × ROAS Meta" subtitle="Receita real da Shopify versus retorno atribuído pela plataforma" labels={labels} datasets={[
        { label: 'MER', data: business.map(x => Number(x.mer || 0)), borderColor: plum, backgroundColor: 'rgba(109,47,105,.08)', fill: true, borderWidth: 3, tension: .35, pointRadius: 3 },
        { label: 'ROAS Meta', data: business.map(x => Number(x.meta_roas || 0)), borderColor: blush, borderWidth: 2, tension: .35, pointRadius: 3 },
      ]} />
      <ChartCard title="Pedidos × CAC blended" subtitle="Volume real e custo de aquisição sobre pedidos Shopify" labels={labels} datasets={[
        { type: 'bar', label: 'Pedidos', data: business.map(x => Number(x.shopify_orders || 0)), backgroundColor: 'rgba(45,27,43,.13)', borderColor: ink, borderWidth: 1, borderRadius: 8 },
        { type: 'line', label: 'CAC blended', data: business.map(x => Number(x.shopify_orders || 0) ? Number(x.meta_spend || 0) / Number(x.shopify_orders || 0) : 0), borderColor: rose, borderWidth: 3, tension: .35, pointRadius: 3 },
      ]} />
      <ChartCard title="Sessões × conversão" subtitle="Tráfego real da loja e capacidade de transformar sessão em compra" labels={labels} datasets={[
        { type: 'bar', label: 'Sessões', data: business.map(x => Number(x.sessions || 0)), backgroundColor: 'rgba(196,154,175,.22)', borderColor: blush, borderWidth: 1, borderRadius: 8 },
        { type: 'line', label: 'Conversão %', data: business.map(x => Number(x.conversion_rate || 0) * 100), borderColor: plum, borderWidth: 3, tension: .35, pointRadius: 3 },
      ]} />
    </div>

    <SectionHeader number="02" eyebrow="FUNIL" title="Do clique à compra" description="A leitura em duas camadas evita conclusões erradas: Meta mostra eventos atribuídos; Shopify mostra o comportamento comercial real do site." />
    <div className="grid-two funnel-layout">
      <Surface eyebrow="META ADS" title="Funil de mídia paga" description="Eventos atribuídos pela plataforma no mês selecionado.">
        <Funnel rows={metaFunnel} />
        <div className="mini-metric-grid four">
          <MiniMetric label="Clique → página" value={pct(fm.click_to_lpv || 0)} helper={fm.cost_per_lpv ? `Custo ${money(fm.cost_per_lpv)}` : null} />
          <MiniMetric label="Página → carrinho" value={pct(fm.lpv_to_cart || 0)} helper={fm.cost_per_cart ? `Custo ${money(fm.cost_per_cart)}` : null} />
          <MiniMetric label="Carrinho → checkout" value={pct(fm.cart_to_checkout || 0)} helper={fm.cost_per_checkout ? `Custo ${money(fm.cost_per_checkout)}` : null} />
          <MiniMetric label="Checkout → compra" value={pct(fm.checkout_to_purchase || 0)} helper={fm.cost_per_purchase ? `Custo ${money(fm.cost_per_purchase)}` : null} />
        </div>
      </Surface>
      <Surface eyebrow="SHOPIFY" title="Funil real da loja" description="Sessões e eventos consolidados da Shopify no mesmo mês.">
        <Funnel rows={shopifyFunnel} color="soft" />
        <div className="mini-metric-grid four">
          <MiniMetric label="Sessão → carrinho" value={pct(rate(current.cart_additions, current.sessions))} />
          <MiniMetric label="Carrinho → checkout" value={pct(rate(current.reached_checkout, current.cart_additions))} />
          <MiniMetric label="Checkout → compra" value={pct(rate(current.completed_checkout || current.shopify_orders, current.reached_checkout))} />
          <MiniMetric label="Sessão → compra" value={pct(shopifyPurchaseRate)} />
        </div>
      </Surface>
    </div>

    <SectionHeader number="03" eyebrow="EFICIÊNCIA DE ENTREGA" title="CPM, CPC, CTR e frequência" description="Quatro sinais diferentes do leilão: preço de exposição, preço do clique, capacidade de gerar atenção e pressão de repetição." />
    <div className="kpi-grid four">
      <KpiCard label="CPM" value={money(fm.cpm)} current={fm.cpm} previous={previousFunnel.cpm} inverse footer="Custo por mil impressões" />
      <KpiCard label="CPC" value={money(fm.cpc)} current={fm.cpc} previous={previousFunnel.cpc} inverse footer="Custo por clique" />
      <KpiCard label="CTR" value={pct(fm.ctr || 0)} current={fm.ctr} previous={previousFunnel.ctr} footer="Taxa de clique" />
      <KpiCard label="Frequência" value={num(fm.frequency)} current={fm.frequency} previous={previousFunnel.frequency} inverse footer="Exposições por pessoa alcançada" />
    </div>
    <div className="chart-grid four delivery-charts">
      <ChartCard title="CPM" subtitle="Pressão de leilão" labels={labels} height={220} datasets={[{ data: business.map(x => Number(fMap.get(x.month_start)?.cpm || 0)), borderColor: plum, backgroundColor: 'rgba(109,47,105,.08)', fill: true, borderWidth: 3, tension: .35, pointRadius: 2 }]} />
      <ChartCard title="CPC" subtitle="Preço do tráfego" labels={labels} height={220} datasets={[{ data: business.map(x => Number(fMap.get(x.month_start)?.cpc || 0)), borderColor: rose, backgroundColor: 'rgba(168,93,124,.08)', fill: true, borderWidth: 3, tension: .35, pointRadius: 2 }]} />
      <ChartCard title="CTR" subtitle="Capacidade de gerar clique" labels={labels} height={220} datasets={[{ data: business.map(x => Number(fMap.get(x.month_start)?.ctr || 0)), borderColor: ink, borderWidth: 3, tension: .35, pointRadius: 2 }]} />
      <ChartCard title="Frequência" subtitle="Pressão de exposição" labels={labels} height={220} datasets={[{ data: business.map(x => Number(fMap.get(x.month_start)?.frequency || 0)), borderColor: blush, borderWidth: 3, tension: .35, pointRadius: 2 }]} />
    </div>

    <SectionHeader number="04" eyebrow="ECONOMIA DA AQUISIÇÃO" title="Qualidade do tráfego e valor gerado" description="Indicadores que ajudam a decidir se o problema está em mídia, site ou monetização." />
    <div className="mini-metric-grid six economics-strip">
      <MiniMetric label="Custo por LPV" value={money(fm.cost_per_lpv || 0)} />
      <MiniMetric label="Custo por carrinho" value={money(fm.cost_per_cart || 0)} />
      <MiniMetric label="Custo por checkout" value={money(fm.cost_per_checkout || 0)} />
      <MiniMetric label="Custo por compra Meta" value={money(fm.cost_per_purchase || 0)} />
      <MiniMetric label="Receita por sessão" value={money(Number(current.sessions || 0) ? Number(current.shopify_revenue || 0) / Number(current.sessions || 0) : 0)} />
      <MiniMetric label="Ticket médio" value={money(aov)} />
    </div>

    {performance?.business && <Surface className="executive-footnote" eyebrow="CONTEXTO" title="Leitura complementar de 30 dias">
      <div className="mini-metric-grid four">
        <MiniMetric label="Receita por sessão" value={money(performance.business.revenue_per_session || 0)} />
        <MiniMetric label="CAC blended 30d" value={money(performance.business.blended_cac || 0)} />
        <MiniMetric label="Novos clientes" value={integer(performance.business.new_customers || 0)} />
        <MiniMetric label="Taxa carrinho Shopify" value={pct(performance.business.shopify_atc_rate || 0)} />
      </div>
    </Surface>}
  </div>
}
