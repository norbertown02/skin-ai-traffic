import React, { useMemo, useState } from 'react'
import { ChartCard } from '../components/Charts.jsx'
import { DecisionCard, Insight, KpiCard, MiniMetric, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { dateTime, integer, money, num, pct, priorityRank, sourceDate } from '../lib/format.js'
import { api, endpoints } from '../api.js'

function qualitySummary(rows = []) {
  if (!rows.length) return { tone: 'neutral', title: 'Sem alerta de qualidade', text: 'Nenhum diagnóstico de qualidade retornado pela camada contínua.' }
  const critical = rows.filter(x => ['critical', 'bad', 'error', 'blocked'].includes(String(x.status || x.level || '').toLowerCase()))
  if (critical.length) return { tone: 'warning', title: 'Há restrições na qualidade dos dados', text: `${critical.length} verificação(ões) pedem atenção antes de decisões mais agressivas.` }
  return { tone: 'positive', title: 'Base operacional utilizável', text: 'As verificações disponíveis não apontam uma falha crítica de dados neste momento.' }
}

export default function ManagerPage({ data, onOpen, onRefresh }) {
  const manager = data?.manager || {}
  const main = data?.bootstrap?.main || {}
  const performance = data?.bootstrap?.performance || {}
  const business = data?.shopify?.business || []
  const currentBusiness = business.at(-1) || {}
  const account = main?.cur?.k || {}
  const [running, setRunning] = useState(false)
  const decisions = useMemo(() => (manager.decisions || []).filter(x => x.model === 'traffic-manager-v3').sort((a, b) => priorityRank(b.recommended_action?.priority || b.severity) - priorityRank(a.recommended_action?.priority || a.severity)), [manager.decisions])
  const open = decisions.filter(x => x.status === 'open')
  const top = open[0] || decisions[0]
  const action = top?.recommended_action || {}
  const observations = (manager.observations || []).slice(0, 5)
  const hypotheses = (manager.hypotheses || []).slice(0, 4)
  const experiments = (manager.experiments || []).slice(0, 4)
  const learnings = (manager.learnings || []).slice(0, 4)
  const quality = qualitySummary(manager.quality || [])
  const source = sourceDate(data)
  const series = performance?.daily || main?.daily || []
  const labels = series.map(x => String(x.date || '').slice(5))

  async function runManager() {
    setRunning(true)
    try {
      await api(endpoints.manager, { method: 'POST', body: JSON.stringify({ action: 'run' }) })
      await onRefresh?.()
    } finally { setRunning(false) }
  }

  return <div className="page manager-page">
    <PageHeader
      eyebrow="GESTOR IA"
      title="Consultor de tráfego da operação"
      description="Diagnóstico, evidências, plano de ação e acompanhamento. A IA não substitui a decisão; organiza o que merece atenção e como validar cada hipótese."
      meta={source ? <>Meta histórico até <strong>{new Date(`${source}T12:00:00`).toLocaleDateString('pt-BR')}</strong> · Shopify consolidado mensal</> : null}
      actions={<button className="btn primary" onClick={runManager} disabled={running}>{running ? 'Analisando…' : 'Atualizar consultor'}</button>}
    />

    <div className="manager-pulse">
      <div className="manager-pulse-copy"><span className="eyebrow">PRIORIDADE ATUAL</span><h2>{top?.title || 'Nenhuma decisão crítica aberta'}</h2><p>{action.diagnosis || action.executive_summary || top?.rationale || 'O sistema está monitorando a operação e aguardando evidência suficiente para uma nova recomendação.'}</p>{top && <button className="btn light" onClick={() => onOpen?.(top.id)}>Abrir diagnóstico completo</button>}</div>
      <div className="manager-pulse-action"><span>AÇÃO RECOMENDADA</span><strong>{action.exact_action || 'Manter monitoramento e preservar testes ativos até haver sinal suficiente.'}</strong>{action.validation_window_days && <small>Janela de validação: {action.validation_window_days} dias</small>}</div>
    </div>

    <div className="kpi-grid six">
      <KpiCard label="Investimento Meta · 30d" value={money(account.spend || performance?.periods?.current30?.spend)} note="Janela operacional" />
      <KpiCard label="ROAS Meta · 30d" value={num(account.roas || performance?.periods?.current30?.roas)} note="Receita atribuída" />
      <KpiCard label="CTR · 30d" value={pct(account.ctr || performance?.periods?.current30?.link_ctr || 0)} note="Sinal de atenção" />
      <KpiCard label="CPC · 30d" value={money(account.cpc || performance?.periods?.current30?.link_cpc || 0)} note="Custo de tráfego" />
      <KpiCard label="Pedidos Shopify · mês" value={integer(currentBusiness.shopify_orders)} note="Fonte comercial consolidada" accent />
      <KpiCard label="Receita Shopify · mês" value={money(currentBusiness.shopify_revenue)} note={`MER ${num(currentBusiness.mer)}`} accent />
    </div>

    <div className="executive-insights manager-insights">
      <Insight label="QUALIDADE DOS DADOS" title={quality.title} text={quality.text} tone={quality.tone} />
      <Insight label="ANOMALIA" title={`Score ${integer(performance?.anomaly?.score || 0)}/100`} text={(performance?.anomaly?.items || []).filter(x => x.direction === 'bad').slice(0, 2).map(x => `${x.label}: ${x.change_pct >= 0 ? '+' : ''}${num(x.change_pct, 1)}%`).join(' · ') || 'Nenhuma deterioração forte detectada na comparação de 7 dias.'} tone={Number(performance?.anomaly?.score || 0) > 50 ? 'warning' : 'neutral'} />
      <Insight label="CONCENTRAÇÃO CRIATIVA" title={`${pct(performance?.concentration?.top3_spend_share || 0)} no top 3`} text={`${integer(performance?.concentration?.active_creatives || 0)} criativos ativos com entrega na janela analisada.`} />
    </div>

    <SectionHeader number="01" eyebrow="DECISÕES" title="O que merece ação agora" description="Priorização por impacto e urgência. Cada recomendação traz diagnóstico, ação proposta, impacto esperado e risco." aside={<span className="counter-pill">{open.length} pendente{open.length === 1 ? '' : 's'}</span>} />
    <div className="decision-list">{open.length ? open.slice(0, 4).map(d => <DecisionCard key={d.id} decision={d} onOpen={onOpen} condensed={false} />) : <Surface><p className="muted-copy">Nenhuma decisão V3 aberta. O consultor continua monitorando a operação.</p></Surface>}</div>

    <SectionHeader number="02" eyebrow="SINAIS" title="O que a operação está mostrando" description="Observações, hipóteses e aprendizados mantêm a análise contínua conectada ao histórico em vez de reagir a um único dia." />
    <div className="grid-two">
      <Surface eyebrow="OBSERVAÇÕES ATIVAS" title="Sinais encontrados">
        <div className="signal-list">{observations.length ? observations.map((x, i) => <div className="signal-row" key={x.id || i}><span>{i + 1}</span><div><strong>{x.title || x.observation || x.summary || 'Observação'}</strong><p>{x.description || x.evidence || x.detail || 'Sinal registrado pelo motor contínuo.'}</p></div></div>) : <p className="muted-copy">Nenhuma observação ativa retornada.</p>}</div>
      </Surface>
      <Surface eyebrow="HIPÓTESES" title="O que precisa ser validado">
        <div className="signal-list">{hypotheses.length ? hypotheses.map((x, i) => <div className="signal-row" key={x.id || i}><span>{i + 1}</span><div><strong>{x.title || x.hypothesis || x.summary || 'Hipótese'}</strong><p>{x.description || x.reason || x.detail || 'Hipótese mantida em aberto pelo motor.'}</p></div></div>) : <p className="muted-copy">Nenhuma hipótese aberta no momento.</p>}</div>
      </Surface>
    </div>

    <div className="chart-grid two manager-charts">
      <ChartCard title="ROAS atribuído · diário" subtitle="Oscilação recente da eficiência Meta" labels={labels} datasets={[{ label: 'ROAS', data: series.map(x => Number(x.roas || 0)), borderColor: '#6d2f69', backgroundColor: 'rgba(109,47,105,.08)', fill: true, borderWidth: 3, tension: .35, pointRadius: 1 }]} />
      <ChartCard title="CTR × CPC · diário" subtitle="Atenção e custo do tráfego na mesma janela" labels={labels} datasets={[{ label: 'CTR', data: series.map(x => Number(x.link_ctr || x.ctr || 0)), borderColor: '#6d2f69', borderWidth: 3, tension: .35, pointRadius: 1 }, { label: 'CPC', data: series.map(x => Number(x.link_cpc || x.cpc || 0)), borderColor: '#c49aaf', borderWidth: 2, tension: .35, pointRadius: 1 }]} />
    </div>

    <SectionHeader number="03" eyebrow="EXPERIMENTOS" title="Testes e validações em andamento" description="Uma operação profissional registra o que está sendo testado, qual hipótese sustenta o teste e quando decidir manter ou reverter." />
    <div className="grid-two">
      <Surface eyebrow="EXPERIMENTOS ATIVOS" title="Fila de validação">
        <div className="experiment-list">{experiments.length ? experiments.map((x, i) => <div className="experiment-row" key={x.id || i}><div><strong>{x.title || x.name || x.experiment_type || 'Experimento'}</strong><p>{x.hypothesis || x.description || x.notes || 'Teste registrado no motor contínuo.'}</p></div><span>{x.status || 'proposed'}</span></div>) : <p className="muted-copy">Nenhum experimento ativo.</p>}</div>
      </Surface>
      <Surface eyebrow="MEMÓRIA" title="Aprendizados ativos">
        <div className="learning-list">{learnings.length ? learnings.map((x, i) => <div key={x.id || i}><strong>{x.title || x.learning || x.summary || 'Aprendizado'}</strong><p>{x.description || x.detail || x.evidence || 'Registro de aprendizado operacional.'}</p></div>) : <p className="muted-copy">Ainda não há aprendizados consolidados suficientes.</p>}</div>
      </Surface>
    </div>

    <SectionHeader number="04" eyebrow="CONTROLE OPERACIONAL" title="Estado do sistema" description="Transparência sobre dados, execução e última atualização do motor." />
    <Surface className="system-strip">
      <div className="mini-metric-grid four">
        <MiniMetric label="Última execução V3" value={manager.runs?.[0]?.started_at ? dateTime(manager.runs[0].started_at) : '—'} />
        <MiniMetric label="Decisões abertas" value={integer(open.length)} />
        <MiniMetric label="Experimentos ativos" value={integer(experiments.length)} />
        <MiniMetric label="Modo" value={action.historical_mode ? 'Histórico / bloqueado' : 'Leitura operacional'} helper={action.execution_locked ? 'Execução automática bloqueada' : 'Aprovação manual'} />
      </div>
    </Surface>
  </div>
}
