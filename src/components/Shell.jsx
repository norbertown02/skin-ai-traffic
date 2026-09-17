import React from 'react'
import { sourceDate } from '../lib/format.js'

const groups = [
  { label: 'Direção', items: [['strategy', 'Estratégia'], ['manager', 'Gestor'], ['executive', 'Relatório Gerencial']] },
  { label: 'Decisão', items: [['analysis', 'Análise'], ['approvals', 'Aprovações'], ['waste', 'Desperdícios']] },
  { label: 'Inteligência', items: [['creatives', 'Criativos'], ['audiences', 'Públicos'], ['placements', 'Placements']] },
  { label: 'Mídia', items: [['campaigns', 'Campanhas'], ['sets', 'Conjuntos'], ['ads', 'Anúncios']] },
  { label: 'Sistema', items: [['integrations', 'Integrações']] },
]

const marks = {
  strategy: 'ES', manager: 'GE', executive: 'RG', approvals: 'OK', analysis: 'AN', creatives: 'CR', audiences: 'PU', placements: 'PL', campaigns: 'CA', sets: 'CJ', ads: 'AD', waste: 'DP', integrations: 'IN',
}

export default function Shell({ tab, onTab, data, onLogout, children }) {
  const metaDate = sourceDate(data)
  const shopMonth = data?.shopify?.business?.at?.(-1)?.month_start
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-block"><div><strong>Skin Beauty</strong><span>Growth Operating System</span></div></div>
      <div className="sidebar-scroll">{groups.map(group => <div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => onTab(key)}><i>{marks[key]}</i><span>{label}</span>{tab === key && <b />}</button>)}</div>)}</div>
      <div className="sidebar-status">
        <div><span className="source-dot shop"/><div><strong>Shopify</strong><small>{shopMonth ? `Consolidado ${shopMonth.slice(5, 7)}/${shopMonth.slice(0, 4)}` : 'Sem consolidado'}</small></div></div>
        <div><span className="source-dot meta"/><div><strong>Meta Ads</strong><small>{metaDate ? `Histórico até ${metaDate.split('-').reverse().join('/')}` : 'Sem histórico'}</small></div></div>
      </div>
      <button className="logout-btn" onClick={onLogout}>Sair do painel</button>
    </aside>
    <main className="main-content"><div className="mobile-brand"><strong>Skin Beauty</strong><span>Growth Operating System</span></div>{children}</main>
  </div>
}
