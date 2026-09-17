import React from 'react'
import { PageHeader, Surface, Badge } from '../components/UI.jsx'
import { monthLabel, sourceDate } from '../lib/format.js'

export default function IntegrationsClean({ data }) {
  const business = data?.shopify?.business || []
  const latestBusiness = business.at(-1)
  const metaDate = sourceDate(data)
  const quality = data?.manager?.quality || []
  const critical = quality.filter(x => ['critical','bad','error','blocked'].includes(String(x.status || x.level || '').toLowerCase()))

  return <div className="page pro-page integrations-page">
    <PageHeader eyebrow="INTEGRAÇÕES" title="Saúde das fontes de dados" description="Separação explícita entre dados armazenados, atualização disponível e conexão ao vivo. Histórico no banco não é tratado como prova de API online." />
    <div className="pro-integration-grid">
      <Surface eyebrow="SHOPIFY" title="Verdade comercial" actions={<Badge tone={business.length ? 'success' : 'danger'}>{business.length ? 'Dados disponíveis' : 'Sem dados'}</Badge>}>
        <h3 className="pro-big-label">{latestBusiness ? monthLabel(latestBusiness.month_start) : '—'}</h3>
        <p className="muted-copy">Pedidos, receita, sessões, carrinho e checkout consolidados. Esta é a fonte comercial usada no Relatório Gerencial e no Gestor IA.</p>
      </Surface>
      <Surface eyebrow="META ADS" title="Entrega e atribuição" actions={<Badge tone={metaDate ? 'warning' : 'danger'}>{metaDate ? 'Histórico disponível' : 'Sem histórico'}</Badge>}>
        <h3 className="pro-big-label">{metaDate ? metaDate.split('-').reverse().join('/') : '—'}</h3>
        <p className="muted-copy">Última data encontrada no histórico de mídia. A existência desse histórico não significa que a API ao vivo esteja operacional neste momento.</p>
      </Surface>
    </div>
    <Surface eyebrow="QUALIDADE" title="Validações do motor">
      {quality.length ? <div className="signal-list">{quality.slice(0,10).map((x,i)=><div className="signal-row" key={x.id || i}><span>{i+1}</span><div><strong>{x.name || x.check_name || x.title || 'Verificação'}</strong><p>{x.message || x.detail || x.description || String(x.status || 'Verificação registrada')}</p></div></div>)}</div> : <p className="muted-copy">Nenhuma validação estruturada de qualidade foi retornada pelo motor contínuo.</p>}
      {critical.length > 0 && <div className="form-error">Há {critical.length} verificação(ões) crítica(s). Evite decisões agressivas até a origem ser validada.</div>}
    </Surface>
  </div>
}
