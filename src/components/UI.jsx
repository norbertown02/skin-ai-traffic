import React from 'react'
import { delta, num, pct, priorityLabel, statusLabel } from '../lib/format.js'

export function PageHeader({ eyebrow, title, description, actions, meta }) {
  return <header className="page-header">
    <div className="page-header-copy">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {meta && <div className="page-meta">{meta}</div>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
}

export function SectionHeader({ number, eyebrow, title, description, aside }) {
  return <div className="section-header">
    <div className="section-index">{number}</div>
    <div className="section-header-copy">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {aside && <div className="section-aside">{aside}</div>}
  </div>
}

export function KpiCard({ label, value, note, current, previous, inverse = false, accent = false, icon, footer }) {
  const change = current !== undefined && previous !== undefined ? delta(current, previous) : null
  const positive = change === null ? null : inverse ? change <= 0 : change >= 0
  return <article className={`kpi-card ${accent ? 'accent' : ''}`}>
    <div className="kpi-label-row">
      <span>{label}</span>
      {icon && <i className="kpi-icon">{icon}</i>}
    </div>
    <strong>{value}</strong>
    <div className="kpi-foot">
      {change !== null ? <span className={positive ? 'trend up' : 'trend down'}>{change >= 0 ? '↗' : '↘'} {Math.abs(change).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span> : note ? <span className="muted">{note}</span> : <span className="muted">Sem comparação</span>}
      {footer && <span className="kpi-footer-note">{footer}</span>}
    </div>
  </article>
}

export function MiniMetric({ label, value, helper, tone = 'neutral' }) {
  return <div className={`mini-metric ${tone}`}><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function PriorityBadge({ value }) {
  const tone = value === 'critical' || value === 'high' ? 'danger' : value === 'medium' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{priorityLabel(value)}</Badge>
}

export function StatusBadge({ value }) {
  const tone = value === 'approved' ? 'success' : value === 'rejected' ? 'danger' : value === 'open' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{statusLabel(value)}</Badge>
}

export function Surface({ children, className = '', title, eyebrow, description, actions }) {
  return <section className={`surface ${className}`}>
    {(title || eyebrow || actions) && <div className="surface-head">
      <div><span className="eyebrow">{eyebrow}</span>{title && <h3>{title}</h3>}{description && <p>{description}</p>}</div>
      {actions && <div className="surface-actions">{actions}</div>}
    </div>}
    {children}
  </section>
}

export function Insight({ label, title, text, tone = 'neutral', metric }) {
  return <article className={`insight-card ${tone}`}>
    <div className="insight-top"><span>{label}</span>{metric && <strong>{metric}</strong>}</div>
    <h3>{title}</h3>
    <p>{text}</p>
  </article>
}

export function Empty({ children = 'Sem dados disponíveis para este recorte.' }) {
  return <div className="empty-state"><div className="empty-dot"/><p>{children}</p></div>
}

export function DataTable({ columns, rows, empty = 'Sem dados disponíveis.', compact = false }) {
  if (!rows?.length) return <Empty>{empty}</Empty>
  return <div className={`table-wrap ${compact ? 'compact' : ''}`}><table><thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.key || index}>{columns.map(c => <td key={c.key} className={c.className ? c.className(row) : ''}>{c.render ? c.render(row, index) : row[c.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>
}

export function Funnel({ rows, color = 'plum' }) {
  const first = Math.max(1, Number(rows?.[0]?.value || 0))
  return <div className={`funnel ${color}`}>{rows.map((row, index) => {
    const value = Number(row.value || 0)
    const previous = index ? Number(rows[index - 1]?.value || 0) : first
    const step = index ? (value / Math.max(1, previous)) * 100 : 100
    const cumulative = (value / first) * 100
    return <div className="funnel-item" key={row.label}>
      <div className="funnel-copy"><span>{row.label}</span><small>{index ? `${pct(step)} da etapa anterior` : 'Entrada do funil'}</small></div>
      <div className="funnel-track"><div className="funnel-fill" style={{ width: `${Math.max(2, Math.min(100, cumulative))}%` }} /></div>
      <strong>{Number(value).toLocaleString('pt-BR')}</strong>
      <em>{pct(cumulative)}</em>
    </div>
  })}</div>
}

export function DecisionCard({ decision, onOpen, onApprove, onReject, condensed = false }) {
  const action = decision?.recommended_action || {}
  const evidence = Array.isArray(action.evidence_summary) ? action.evidence_summary : []
  return <article className={`decision-card ${condensed ? 'condensed' : ''}`}>
    <div className="decision-top"><div className="decision-badges"><PriorityBadge value={action.priority || decision.severity}/><StatusBadge value={decision.status}/></div><span className="decision-entity">{decision.entity_type || 'account'}</span></div>
    <h3>{decision.title}</h3>
    <p className="decision-diagnosis">{action.diagnosis || action.executive_summary || decision.rationale || 'Sem diagnóstico textual.'}</p>
    {!condensed && <>
      {action.exact_action && <div className="decision-action"><span>AÇÃO PROPOSTA</span><strong>{action.exact_action}</strong></div>}
      <div className="decision-meta-grid">
        <div><span>Impacto esperado</span><p>{action.expected_impact || '—'}</p></div>
        <div><span>Risco</span><p>{action.risk || '—'}</p></div>
      </div>
      {evidence.length > 0 && <div className="evidence-list">{evidence.slice(0, 3).map((item, i) => <div key={i}><span>{i + 1}</span><p>{typeof item === 'string' ? item : JSON.stringify(item)}</p></div>)}</div>}
    </>}
    <div className="decision-buttons"><button className="btn ghost" onClick={() => onOpen?.(decision.id)}>Ver diagnóstico</button>{decision.status === 'open' && onReject && <button className="btn subtle danger-text" onClick={() => onReject(decision.id)}>Rejeitar</button>}{decision.status === 'open' && onApprove && <button className="btn primary" onClick={() => onApprove(decision.id)}>Aprovar</button>}</div>
  </article>
}

export function Progress({ value, label, helper }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)))
  return <div className="progress-row"><div className="progress-copy"><span>{label}</span><strong>{num(v, 0)}%</strong></div><div className="progress-track"><div style={{ width: `${v}%` }}/></div>{helper && <small>{helper}</small>}</div>
}
