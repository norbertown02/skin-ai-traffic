
import React, { useState } from 'react'
import { sourceDate } from '../lib/format.js'

const primary = [
  ['cockpit','Visão geral','01'],
  ['campaigns','Campanhas','02'],
  ['creatives','Criativos','03'],
  ['audiences','Públicos','04'],
  ['funnel','Funil e Loja','05'],
  ['commerce','Produtos e recorrência','CM'],
  ['economics','Rentabilidade','06'],
  ['experiments','Testes e decisões','07'],
  ['integrations','Qualidade dos dados','08'],
]
const secondary = [
  ['manager','Diagnóstico completo','DG'],['strategy','Metas e limites','MT'],
  ['executive','Relatório gerencial','RG'],['actions','O que fazer agora','AC'],['compare','Comparador','CM'],
  ['analysis','Análise detalhada','AN'],['placements','Posicionamentos','PL'],
  ['sets','Conjuntos','CJ'],['ads','Anúncios','AD'],
  ['waste','Verba sob análise','DP'],['history','Histórico de mudanças','HM']
]

export default function Shell({tab,onTab,data,onLogout,children}) {
  const [advanced, setAdvanced] = useState(true)
  const lastMeta = sourceDate(data)
  const shopMonth = data?.shopify?.business?.filter(row => row.has_shopify).at(-1)?.month_start
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-block"><div><strong>Skin Beauty</strong><span>Gestor de performance</span></div></div>
      <div className="sidebar-scroll">
        <div className="nav-group"><small>DECISÕES</small>
          {primary.map(([key,label,mark]) => <button key={key} onClick={() => onTab(key)} className={tab === key ? 'active' : ''}><i>{mark}</i><span>{label}</span>{tab === key && <b/>}</button>)}
        </div>
        <div className="nav-group"><button type="button" className={'ac-advanced-toggle ' + (advanced ? 'expanded' : '')} aria-expanded={advanced} onClick={() => setAdvanced(x => !x)}><i>+</i><span>{advanced ? 'Ocultar análises' : 'Mais análises e configurações'}</span></button>
          {(advanced || secondary.some(([key]) => key === tab)) && secondary.map(([key,label,mark]) => <button key={key} onClick={() => onTab(key)} className={tab === key ? 'active' : ''}><i>{mark}</i><span>{label}</span>{tab === key && <b/>}</button>)}
        </div>
      </div>
      <div className="sidebar-status">
        <div><span className="source-dot shop"/><div><strong>Shopify</strong><small>{shopMonth ? 'Mês ' + shopMonth.slice(5,7) + '/' + shopMonth.slice(0,4) : 'Sem consolidado'}</small></div></div>
        <div><span className="source-dot meta"/><div><strong>Meta Ads</strong><small>{lastMeta ? 'Até ' + lastMeta.split('-').reverse().join('/') : 'Sem data de leitura'}</small></div></div>
      </div>
      <button className="logout-btn" onClick={onLogout}>Sair do painel</button>
    </aside>
    <main className="main-content"><div className="mobile-brand"><strong>Skin Beauty</strong><span>Gestor de performance</span></div>{children}</main>
  </div>
}
