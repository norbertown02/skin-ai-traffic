import React from 'react'
import { sourceDate } from '../lib/format.js'

const groups = [
  { label: 'Gestão', items: [['manager', 'Gestor IA'], ['executive', 'Relatório Gerencial'], ['approvals', 'Aprovações']] },
  { label: 'Análise', items: [['analysis', 'Análise Detalhada'], ['creatives', 'Criativos'], ['audiences', 'Públicos'], ['placements', 'Placements']] },
  { label: 'Mídia', items: [['campaigns', 'Campanhas'], ['sets', 'Conjuntos'], ['ads', 'Anúncios'], ['waste', 'Desperdícios']] },
  { label: 'Sistema', items: [['integrations', 'Integrações']] },
]

const marks = {
  manager: 'AI', executive: 'R', approvals: '✓', analysis: 'A', creatives: 'C', audiences: 'P', placements: 'PL', campaigns: 'CM', sets: 'CJ', ads: 'AD', waste: '!', integrations: '•',
}

export default function Shell({ tab, onTab, data, onLogout, children }) {
  const metaDate = sourceDate(data)
  const shopMonth = data?.shopify?.business?.at?.(-1)?.month_start
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-block"><div className="brand-symbol">S</div><div><strong>SKIN BEAUTY</strong><span>AI TRAFFIC MANAGER</span></div></div>
      <div className="sidebar-scroll">{groups.map(group => <div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => onTab(key)}><i>{marks[key]}</i><span>{label}</span>{tab === key && <b />}</button>)}</div>)}</div>
      <div className="sidebar-status">
        <div><span className="source-dot shop"/><div><strong>Shopify</strong><small>{shopMonth ? `Consolidado ${shopMonth.slice(5, 7)}/${shopMonth.slice(0, 4)}` : 'Conectado'}</small></div></div>
        <div><span className="source-dot meta"/><div><strong>Meta Ads</strong><small>{metaDate ? `Histórico até ${metaDate.split('-').reverse().join('/')}` : 'Histórico'}</small></div></div>
      </div>
      <button className="logout-btn" onClick={onLogout}>Sair do painel</button>
    </aside>
    <main className="main-content"><div className="mobile-brand"><strong>SKIN BEAUTY</strong><span>AI TRAFFIC MANAGER</span></div>{children}</main>
  </div>
}
