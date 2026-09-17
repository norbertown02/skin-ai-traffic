export const money = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 2,
}).format(Number(value || 0))

export const compactMoney = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
}).format(Number(value || 0))

export const num = (value, digits = 2) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits })
export const integer = (value) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
export const pct = (value, digits = 1) => `${num(value, digits)}%`
export const ratio = (a, b) => Number(b || 0) ? Number(a || 0) / Number(b || 0) : 0
export const rate = (a, b) => ratio(a, b) * 100
export const delta = (current, previous) => Number(previous || 0) ? ((Number(current || 0) - Number(previous || 0)) / Number(previous || 0)) * 100 : null
export const deltaText = (current, previous) => {
  const value = delta(current, previous)
  if (value === null) return 'Sem base comparável'
  return `${value >= 0 ? '+' : ''}${num(value, 1)}% vs mês anterior`
}
export const monthLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'
export const shortMonth = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '—'
export const dayLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
export const dateTime = (value) => {
  try { return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}
export const safeArray = (value) => Array.isArray(value) ? value : []
export const priorityRank = (value) => ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[String(value || '').toLowerCase()] ?? 0)
export const priorityLabel = (value) => ({ critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa', info: 'Informativa' }[String(value || '').toLowerCase()] || 'Média')
export const statusLabel = (value) => ({ open: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada', expired: 'Expirada', running: 'Em teste', validating: 'Validando', proposed: 'Proposto' }[String(value || '').toLowerCase()] || String(value || '—'))
export const sourceDate = (data) => data?.bootstrap?.main?.daily?.at?.(-1)?.date || data?.bootstrap?.main?.period?.end || null
