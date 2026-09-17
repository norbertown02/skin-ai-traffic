import React, { useEffect, useMemo, useState } from 'react'
import { ChartCard } from './Charts.jsx'
import { Badge, MiniMetric, SectionHeader, Surface } from './UI.jsx'
import { api, endpoints } from '../api.js'
import { dateTime, money, num, pct, statusLabel } from '../lib/format.js'

export default function DiagnosticModal({ id, onClose, onRefresh }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setData(null); setError('')
    api(`${endpoints.manager}?decision_id=${encodeURIComponent(id)}`)
      .then(x => active && setData(x))
      .catch(e => active && setError(e.message || 'Falha ao carregar diagnóstico.'))
    return () => { active = false }
  }, [id])

  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const metaSeries = useMemo(() => data?.series?.meta || [], [data])
  const labels = metaSeries.map(x => String(x.date || '').slice(5))
  const explain = data?.explain || {}
  const decision = data?.decision || {}
  const evidence = Array.isArray(explain.evidence) ? explain.evidence : []
  const steps = Array.isArray(explain.steps) ? explain.steps : []
  const dont = Array.isArray(explain.dont) ? explain.dont : []
  const success = explain.success && typeof explain.success === 'object' ? Object.entries(explain.success) : []

  async function review(review) {
    setBusy(true)
    try {
      await api(endpoints.secure, { method: 'POST', body: JSON.stringify({ action: 'review', decision_id: id, review }) })
      await onRefresh?.()
      onClose?.()
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
    <div className="diagnostic-modal">
      <div className="modal-topbar"><div><span>DIAGNÓSTICO DO GESTOR IA</span><small>Decisão {id?.slice?.(0, 8)}</small></div><button className="modal-close" onClick={onClose}>Fechar</button></div>
      {!data && !error && <div className="modal-loading"><span/><p>Carregando diagnóstico, evidências e série histórica…</p></div>}
      {error && <div className="modal-loading error"><p>{error}</p></div>}
      {data && <div className="modal-content">
        <header className="diagnostic-header">
          <div><div className="decision-badges"><Badge tone={decision.status === 'open' ? 'warning' : decision.status === 'approved' ? 'success' : 'neutral'}>{statusLabel(decision.status)}</Badge><Badge>{decision.entity_type || 'account'}</Badge>{explain.mode === 'historical_test' && <Badge tone="warning">Modo histórico</Badge>}</div><h1>{explain.title || decision.title}</h1><p>{explain.diagnosis || decision.rationale}</p></div>
          <div className="diagnostic-side"><span>CRIADO EM</span><strong>{decision.created_at ? dateTime(decision.created_at) : '—'}</strong>{explain.window_days && <><span>VALIDAÇÃO</span><strong>{explain.window_days} dias</strong></>}</div>
        </header>

        <div className="diagnostic-callout"><span>AÇÃO RECOMENDADA</span><strong>{explain.action || 'Sem ação detalhada.'}</strong><p>{explain.impact || ''}</p></div>

        <div className="mini-metric-grid four diagnostic-metrics">
          <MiniMetric label="Risco" value={explain.risk || '—'} />
          <MiniMetric label="Entidade" value={explain.entity_type || '—'} helper={explain.entity_id || ''} />
          <MiniMetric label="Experimentos ligados" value={data.experiments?.length || 0} />
          <MiniMetric label="Estado" value={data.entity_state?.state || data.entity_state?.status || 'Monitorando'} />
        </div>

        <SectionHeader number="01" eyebrow="EVIDÊNCIAS" title="Por que essa recomendação existe" description="A leitura separa evidência observada de interpretação. Use os sinais abaixo para decidir se a recomendação faz sentido operacionalmente." />
        <div className="evidence-grid">{evidence.length ? evidence.map((item, i) => <div className="evidence-card" key={i}><span>{String(i + 1).padStart(2, '0')}</span><p>{typeof item === 'string' ? item : JSON.stringify(item)}</p></div>) : <Surface><p className="muted-copy">Nenhuma evidência textual estruturada foi retornada para essa decisão.</p></Surface>}</div>

        {metaSeries.length > 1 && <>
          <SectionHeader number="02" eyebrow="SÉRIE META" title="Comportamento recente da entidade" description="Série histórica usada para contextualizar a decisão. A receita Shopify comercial continua sendo lida pelo consolidado mensal oficial, não por essa série operacional." />
          <div className="chart-grid two">
            <ChartCard title="Investimento × ROAS" labels={labels} datasets={[{ type: 'bar', label: 'Investimento', data: metaSeries.map(x => Number(x.spend || 0)), backgroundColor: 'rgba(109,47,105,.18)', borderColor: '#6d2f69', borderWidth: 1, borderRadius: 7 }, { type: 'line', label: 'ROAS', data: metaSeries.map(x => Number(x.roas || 0)), borderColor: '#a85d7c', borderWidth: 3, tension: .35, pointRadius: 1 }]} />
            <ChartCard title="CTR × CPC" labels={labels} datasets={[{ label: 'CTR', data: metaSeries.map(x => Number(x.ctr || 0)), borderColor: '#6d2f69', borderWidth: 3, tension: .35, pointRadius: 1 }, { label: 'CPC', data: metaSeries.map(x => Number(x.cpc || 0)), borderColor: '#c49aaf', borderWidth: 2, tension: .35, pointRadius: 1 }]} />
          </div>
        </>}

        <SectionHeader number="03" eyebrow="PLANO" title="Como executar e como validar" description="A recomendação só vira boa gestão quando tem passos claros, critério de sucesso e condição de rollback." />
        <div className="grid-two">
          <Surface eyebrow="EXECUÇÃO" title="Passos sugeridos">
            <div className="steps-list">{steps.length ? steps.map((step, i) => <div key={i}><span>{i + 1}</span><p>{typeof step === 'string' ? step : JSON.stringify(step)}</p></div>) : <p className="muted-copy">A ação principal acima é o passo recomendado. Não há subtarefas estruturadas adicionais.</p>}</div>
          </Surface>
          <Surface eyebrow="CRITÉRIO DE SUCESSO" title="O que precisa melhorar">
            <div className="criteria-list">{success.length ? success.map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</strong></div>) : <p className="muted-copy">Sem critério estruturado retornado.</p>}</div>
          </Surface>
        </div>

        <div className="grid-two diagnostic-bottom">
          <Surface eyebrow="ROLLBACK" title="Quando desfazer"><p className="diagnostic-text">{explain.rollback || 'Nenhuma regra de rollback registrada.'}</p></Surface>
          <Surface eyebrow="NÃO FAZER" title="Restrições e cuidados"><div className="dont-list">{dont.length ? dont.map((x, i) => <p key={i}>• {typeof x === 'string' ? x : JSON.stringify(x)}</p>) : <p className="diagnostic-text">Nenhuma restrição adicional registrada.</p>}</div></Surface>
        </div>

        {decision.status === 'open' && <div className="modal-review-bar"><div><span>DECISÃO HUMANA NECESSÁRIA</span><p>Aprovar registra a decisão; a execução no Meta continua manual.</p></div><div><button className="btn subtle danger-text" disabled={busy} onClick={() => review('reject')}>Rejeitar</button><button className="btn primary" disabled={busy} onClick={() => review('approve')}>{busy ? 'Salvando…' : 'Aprovar recomendação'}</button></div></div>}
      </div>}
    </div>
  </div>
}
