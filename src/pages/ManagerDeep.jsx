import React from 'react'
import { ChartCard, HorizontalBars } from '../components/Charts.jsx'
import { Badge, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct, priorityRank } from '../lib/format.js'

const n=v=>Number(v||0)
const pick=(arr,limit=6)=>(arr||[]).slice(0,limit)

function Metric({label,value,note,tone=''}){return <div className={`deep-metric ${tone}`}><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
function Signal({item}){const change=n(item?.change_pct);return <div className="deep-signal"><div><span>{item?.label||'Sinal'}</span><small>{item?.context||item?.period||''}</small></div><strong className={item?.direction==='bad'?'bad':item?.direction==='good'?'good':''}>{item?.change_pct==null?'—':`${change>0?'+':''}${num(change,1)}%`}</strong></div>}

export default function ManagerDeep({data,onOpen,onRefresh}){
  const manager=data?.manager||{}, perf=data?.bootstrap?.performance||{}, deep=data?.deep||{}, business=data?.shopify?.business||[], current=business.at(-1)||{}
  const decisions=(manager.decisions||[]).filter(x=>x.model==='traffic-manager-v3').sort((a,b)=>priorityRank(b.recommended_action?.priority||b.severity)-priorityRank(a.recommended_action?.priority||a.severity))
  const open=decisions.filter(x=>x.status==='open'), top=open[0]||decisions[0], action=top?.recommended_action||{}
  const anomalies=perf?.anomaly?.items||[], daily=perf?.daily||[], labels=daily.map(x=>String(x.date||'').slice(5))
  const observations=manager.observations||[], hypotheses=manager.hypotheses||[], experiments=manager.experiments||[], learnings=manager.learnings||[]
  const waste=deep?.waste||{}, wasteItems=waste?.items||[]
  const steps=Array.isArray(action.execution_steps)?action.execution_steps:Array.isArray(action.steps)?action.steps:[]
  const evidence=Array.isArray(action.evidence_summary)?action.evidence_summary:[]
  const controls=Array.isArray(action.risk_controls)?action.risk_controls:Array.isArray(action.not_to_do)?action.not_to_do:[]

  return <div className="page deep-page manager-deep">
    <PageHeader eyebrow="GESTOR IA" title="Mesa de decisão" description="Um consultor operacional: identifica o que mudou, conecta evidências, formula uma hipótese e transforma a leitura em um plano de ação verificável." actions={<button className="btn primary" onClick={onRefresh}>Atualizar leitura</button>} />

    <section className="decision-stage">
      <div className="decision-stage-main"><span className="stage-kicker">PRIORIDADE ATUAL</span><h2>{top?.title||'Nenhuma decisão crítica aberta'}</h2><p>{action.diagnosis||action.executive_summary||top?.rationale||'A conta está em monitoramento e ainda não há uma intervenção prioritária.'}</p><div className="stage-actions">{top&&<button className="btn light" onClick={()=>onOpen?.(top.id)}>Abrir diagnóstico completo</button>}<Badge tone={top?.severity==='high'||action.priority==='high'?'danger':'warning'}>{action.priority||top?.severity||'monitoramento'}</Badge></div></div>
      <aside className="decision-stage-side"><span>PRÓXIMA AÇÃO</span><strong>{action.exact_action||'Preservar a estrutura e continuar coletando evidência.'}</strong><div className="decision-side-meta"><div><small>Janela</small><b>{action.validation_window_days?`${action.validation_window_days} dias`:'—'}</b></div><div><small>Decisões abertas</small><b>{integer(open.length)}</b></div><div><small>Experimentos</small><b>{integer(experiments.length)}</b></div></div></aside>
    </section>

    <div className="deep-metric-grid six"><Metric label="Receita Shopify" value={money(current.shopify_revenue)} note="mês consolidado"/><Metric label="Pedidos" value={integer(current.shopify_orders)} note="Shopify"/><Metric label="MER" value={num(current.mer)} note="receita real / mídia"/><Metric label="ROAS Meta" value={num(current.meta_roas)} note="atribuição Meta"/><Metric label="Anomalia" value={`${integer(perf?.anomaly?.score||0)}/100`} note="motor 30 dias"/><Metric label="Exposição potencial" value={money(waste?.summary?.estimated_total)} note="investigável"/></div>

    <SectionHeader number="01" eyebrow="SINAIS" title="O que mudou antes da decisão" description="Primeiro sintomas objetivos; depois interpretação. Isso evita recomendações genéricas ou baseadas em uma métrica isolada."/>
    <div className="deep-two"><Surface eyebrow="COMPORTAMENTO RECENTE" title="Sinais mais relevantes"><div className="deep-signals">{pick(anomalies,7).map((x,i)=><Signal item={x} key={i}/>)}</div></Surface><ChartCard title="CTR e LPV rate" subtitle="Atenção versus qualidade pós-clique" labels={labels} datasets={[{label:'CTR',data:daily.map(x=>n(x.link_ctr||x.ctr)),borderColor:'#48205d',backgroundColor:'rgba(72,32,93,.08)',fill:true,borderWidth:2.5,tension:.35,pointRadius:1.5},{label:'LPV rate',data:daily.map(x=>n(x.lpv_rate)),borderColor:'#a786af',borderWidth:2,tension:.35,pointRadius:1.5}]} height={300}/></div>

    <SectionHeader number="02" eyebrow="EVIDÊNCIA" title="Por que a IA está dizendo isso" description="Toda recomendação precisa deixar visível o caminho entre sinal, evidência e hipótese."/>
    <div className="evidence-board"><div className="evidence-primary">{evidence.length?evidence.slice(0,5).map((x,i)=><article key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{typeof x==='string'?x:JSON.stringify(x)}</p></article>):<article><span>01</span><p>O diagnóstico atual não trouxe evidências estruturadas suficientes.</p></article>}</div><Surface eyebrow="HIPÓTESES" title="O que pode explicar"><div className="hypothesis-list">{pick(hypotheses,5).map((x,i)=><div key={x.id||i}><span>{x.status||'aberta'}</span><strong>{x.title||x.hypothesis||'Hipótese'}</strong><p>{x.description||x.reason||''}</p></div>)||null}{!hypotheses.length&&<p className="muted-copy">Nenhuma hipótese estruturada no momento.</p>}</div></Surface></div>

    <SectionHeader number="03" eyebrow="PLANO" title="Da análise para a execução" description="Ações menores, controláveis e com critério de validação explícito."/>
    <div className="plan-board"><div className="plan-steps">{steps.length?steps.slice(0,7).map((s,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{typeof s==='string'?s:s.title||s.action||'Etapa'}</strong>{typeof s==='object'&&<p>{s.description||s.detail||''}</p>}</div></div>):<div><span>01</span><div><strong>{action.exact_action||'Monitorar antes de alterar'}</strong><p>Sem passos estruturados adicionais no diagnóstico atual.</p></div></div>}</div><div className="plan-side"><Surface eyebrow="VALIDAÇÃO" title="Como saber se funcionou"><p className="deep-copy">{action.validation_plan||action.success_criteria||action.expected_impact||'Comparar a janela posterior com o controle preservado e validar impacto antes de escalar.'}</p></Surface><Surface eyebrow="CONTROLES" title="O que não fazer"><div className="deep-checks">{controls.length?controls.slice(0,5).map((x,i)=><p key={i}>✓ {x}</p>):<><p>✓ Alterar uma variável por vez.</p><p>✓ Preservar um controle comparável.</p><p>✓ Não reagir a baixa amostra.</p></>}</div></Surface></div></div>

    <SectionHeader number="04" eyebrow="INVESTIGAÇÃO" title="Onde aprofundar antes de mexer na conta" description="Sinais de desperdício não são ordens de corte; são pontos para investigar com contexto."/>
    <div className="deep-two"><HorizontalBars title="Maiores exposições investigáveis" subtitle="Sinais classificados pelo motor" rows={wasteItems.map((x,i)=>({key:x.creative_name||x.ad_name||x.type||`Item ${i+1}`,value:n(x.estimated_waste)}))} valueKey="value" formatValue={money}/><Surface eyebrow="OBSERVAÇÕES" title="Memória operacional"><div className="observation-list">{pick(observations,6).map((x,i)=><div key={x.id||i}><span>{x.type||x.category||'sinal'}</span><p>{x.summary||x.observation||x.description||'Observação registrada.'}</p></div>)}{!observations.length&&<p className="muted-copy">Nenhuma observação estruturada disponível.</p>}</div></Surface></div>

    <SectionHeader number="05" eyebrow="APRENDIZADO" title="Experimentos e memória da conta" description="A ferramenta deve aprender com o que foi aprovado, testado e medido — não apenas gerar novos alertas."/>
    <div className="experiment-grid">{pick(experiments,6).map((x,i)=><article key={x.id||i}><span>{x.status||'proposed'}</span><strong>{x.title||x.name||x.experiment_type||'Experimento'}</strong><p>{x.hypothesis||x.description||'Teste ligado a uma decisão do gestor.'}</p></article>)}{!experiments.length&&<article><span>monitoramento</span><strong>Sem experimentos ativos</strong><p>A conta ainda não possui testes estruturados em andamento.</p></article>}</div>
  </div>
}
