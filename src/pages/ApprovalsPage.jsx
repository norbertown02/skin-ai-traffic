import React, { useMemo, useState } from 'react'
import { DecisionCard, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { api, endpoints } from '../api.js'

export default function ApprovalsPage({ data, onOpen, onRefresh }) {
  const [tab, setTab] = useState('open')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const decisions = useMemo(() => (data?.manager?.decisions || []).filter(x => x.model === 'traffic-manager-v3'), [data?.manager?.decisions])
  const filtered = decisions.filter(x => tab === 'all' ? true : x.status === tab)
  const counts = {
    open: decisions.filter(x => x.status === 'open').length,
    approved: decisions.filter(x => x.status === 'approved').length,
    rejected: decisions.filter(x => x.status === 'rejected').length,
  }

  async function review(id, review) {
    if (busy) return
    setBusy(id); setError('')
    try {
      await api(endpoints.secure, { method: 'POST', body: JSON.stringify({ action: 'review', decision_id: id, review }) })
      await onRefresh?.()
    } catch (e) {
      setError(e.message || 'Não foi possível registrar esta decisão. Tente novamente.')
    } finally { setBusy(null) }
  }

  return <div className="page approvals-page">
    <PageHeader eyebrow="APROVAÇÕES" title="Central de decisões do Gestor IA" description="Recomendações ficam separadas da execução. Você revisa diagnóstico, evidência, risco e plano antes de aprovar qualquer ação." />

    {error && <div className="form-error">{error}</div>}

    <div className="approval-summary">
      <div><span>Pendentes</span><strong>{counts.open}</strong></div>
      <div><span>Aprovadas</span><strong>{counts.approved}</strong></div>
      <div><span>Rejeitadas</span><strong>{counts.rejected}</strong></div>
      <div className="approval-summary-note"><span>MODELO DE GOVERNANÇA</span><p>Aprovação obrigatória. O painel não executa mudanças no Meta automaticamente.</p></div>
    </div>

    <div className="tabs">
      {[['open', 'Pendentes'], ['approved', 'Aprovadas'], ['rejected', 'Rejeitadas'], ['all', 'Todas']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setError('') }}>{label}{key !== 'all' && <span>{counts[key] || 0}</span>}</button>)}
    </div>

    <SectionHeader number="01" eyebrow="FILA DE DECISÃO" title={tab === 'open' ? 'O que precisa da sua revisão' : 'Histórico de decisões'} description="Abra o diagnóstico completo para ver evidências, plano de ação, janela de validação, critérios de sucesso e rollback." />

    <div className="decision-list approvals-list">
      {filtered.length ? filtered.map(d => <div key={d.id} className={busy === d.id ? 'is-busy' : ''} style={busy === d.id ? { pointerEvents: 'none', opacity: .65 } : undefined}><DecisionCard decision={d} onOpen={onOpen} onApprove={id => review(id, 'approve')} onReject={id => review(id, 'reject')} /></div>) : <Surface><p className="muted-copy">Nenhuma decisão nessa categoria.</p></Surface>}
    </div>
  </div>
}
