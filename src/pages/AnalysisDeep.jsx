import React, { useMemo, useState } from 'react'
import { ChartCard, HorizontalBars } from '../components/Charts.jsx'
import { DataTable, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { integer, money, num, pct } from '../lib/format.js'

const n=v=>Number(v||0)
const sort=(rows,key='spend')=>(rows||[]).slice().sort((a,b)=>n(b[key])-n(a[key]))
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}

export default function AnalysisDeep({data}){
  const deep=data?.deep||{}, perf=data?.bootstrap?.performance||{}, audience=data?.audience||{}
  const crossAudience=deep?.cross?.creative_audience||[], crossPlacement=deep?.cross?.creative_placement_set||[], waste=deep?.waste||{}, daily=perf?.daily||[], labels=daily.map(x=>String(x.date||'').slice(5))
  const [tab,setTab]=useState('overview')
  const period=perf?.periods?.current30||{}
  const topAudience=sort(crossAudience,'spend').slice(0,12), topPlacement=sort(crossPlacement,'spend').slice(0,12)
  const bestAge=sort((audience.by_age||[]).filter(x=>n(x.spend)>0),'roas')[0]
  const bestGender=sort((audience.by_gender||[]).filter(x=>n(x.spend)>0),'roas')[0]
  const tabs=[['overview','Visão geral'],['audience','Público × criativo'],['placement','Placement × criativo'],['waste','Desperdícios']]

  return <div className="page deep-page analysis-deep">
    <PageHeader eyebrow="ANÁLISE DETALHADA" title="Central de investigação" description="Aprofunda o que o relatório executivo apontou: leilão, atenção, qualidade do clique, público, placement, criativo e fundo de funil."/>
    <div className="tabs deep-tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</div>

    {tab==='overview'&&<>
      <div className="deep-metric-grid six"><Metric label="CPM" value={money(period.cpm)} note="pressão de leilão"/><Metric label="CPC" value={money(period.link_cpc||period.cpc)} note="custo de tráfego"/><Metric label="CTR" value={pct(period.link_ctr||period.ctr)} note="atenção"/><Metric label="LPV rate" value={pct(period.lpv_rate)} note="qualidade do clique"/><Metric label="ROAS" value={num(period.roas)} note="atribuição Meta"/><Metric label="Anomalia" value={`${integer(perf?.anomaly?.score||0)}/100`} note="sinal agregado"/></div>
      <SectionHeader number="01" eyebrow="DINÂMICA" title="Leilão, atenção e pós-clique" description="O objetivo é identificar onde a deterioração começa: antes do clique, na chegada à página ou no fundo do funil."/>
      <div className="deep-two"><ChartCard title="CPM × CPC" subtitle="Leilão e custo de tráfego" labels={labels} datasets={[{label:'CPM',data:daily.map(x=>n(x.cpm)),borderColor:'#48205d',backgroundColor:'rgba(72,32,93,.08)',fill:true,borderWidth:2.5,tension:.35,pointRadius:1.5},{label:'CPC',data:daily.map(x=>n(x.link_cpc||x.cpc)),borderColor:'#a786af',borderWidth:2,tension:.35,pointRadius:1.5}]} height={310}/><ChartCard title="CTR × LPV rate" subtitle="Atenção versus qualidade do clique" labels={labels} datasets={[{label:'CTR',data:daily.map(x=>n(x.link_ctr||x.ctr)),borderColor:'#557866',backgroundColor:'rgba(85,120,102,.08)',fill:true,borderWidth:2.5,tension:.35,pointRadius:1.5},{label:'LPV rate',data:daily.map(x=>n(x.lpv_rate)),borderColor:'#a786af',borderWidth:2,tension:.35,pointRadius:1.5}]} height={310}/></div>
      <SectionHeader number="02" eyebrow="AUDIÊNCIA" title="Quem recebe verba e quem devolve resultado" description="Distribuição de gasto e compra por idade para encontrar concentração ou oportunidades de teste."/>
      <div className="deep-two"><HorizontalBars title="Gasto por idade" subtitle="Últimos 30 dias" rows={audience.by_age||[]} valueKey="spend" formatValue={money}/><HorizontalBars title="Compras por idade" subtitle="Últimos 30 dias" rows={audience.by_age||[]} valueKey="purchases" formatValue={integer}/></div>
      <div className="analysis-highlight-row"><Surface eyebrow="FAIXA ETÁRIA" title="Melhor retorno"><strong className="analysis-big">{bestAge?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestAge?.roas)} · CAC {money(bestAge?.cac)} · {integer(bestAge?.purchases)} compras</p></Surface><Surface eyebrow="GÊNERO" title="Melhor eficiência"><strong className="analysis-big">{bestGender?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestGender?.roas)} · CAC {money(bestGender?.cac)}</p></Surface><Surface eyebrow="DESPERDÍCIO" title="Exposição potencial"><strong className="analysis-big">{money(waste?.summary?.estimated_total)}</strong><p className="muted-copy">Sinal investigável, não verba automaticamente cortável.</p></Surface></div>
    </>}

    {tab==='audience'&&<>
      <SectionHeader number="01" eyebrow="PÚBLICO × CRIATIVO" title="A peça certa para a audiência certa" description="O mesmo criativo pode ser vencedor em um público e fraco em outro. Aqui a análise sai do agregado."/>
      <div className="deep-two"><HorizontalBars title="Maior gasto por combinação" rows={topAudience.map((x,i)=>({key:`${x.creative_name||'Criativo'} · ${x.audience_type||x.ad_set_name||'Público'}`,spend:x.spend}))} valueKey="spend" formatValue={money}/><HorizontalBars title="Maior ROAS por combinação" rows={sort(crossAudience.filter(x=>n(x.spend)>=20),'roas').slice(0,10).map(x=>({key:`${x.creative_name||'Criativo'} · ${x.audience_type||x.ad_set_name||'Público'}`,roas:x.roas}))} valueKey="roas" formatValue={num}/></div>
      <Surface eyebrow="DETALHE" title="Todas as combinações relevantes"><DataTable rows={sort(crossAudience,'spend').slice(0,80)} columns={[{key:'creative_name',label:'Criativo'},{key:'ad_set_name',label:'Conjunto'},{key:'audience_type',label:'Público'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'ctr',label:'CTR',render:r=>pct(r.ctr)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface>
    </>}

    {tab==='placement'&&<>
      <SectionHeader number="01" eyebrow="PLACEMENT × CRIATIVO" title="Onde cada peça funciona melhor" description="Feed, Stories, Reels, Explore e plataforma vistos pelo conjunto peça + contexto, não apenas pela média."/>
      <div className="deep-two"><HorizontalBars title="Maior gasto por combinação" rows={topPlacement.map(x=>({key:`${x.creative_name||'Criativo'} · ${x.publisher_platform||''} ${x.platform_position||''}`,spend:x.spend}))} valueKey="spend" formatValue={money}/><HorizontalBars title="Maior ROAS por combinação" rows={sort(crossPlacement.filter(x=>n(x.spend)>=20),'roas').slice(0,10).map(x=>({key:`${x.creative_name||'Criativo'} · ${x.publisher_platform||''} ${x.platform_position||''}`,roas:x.roas}))} valueKey="roas" formatValue={num}/></div>
      <Surface eyebrow="DETALHE" title="Combinações de entrega"><DataTable rows={sort(crossPlacement,'spend').slice(0,80)} columns={[{key:'creative_name',label:'Criativo'},{key:'publisher_platform',label:'Plataforma'},{key:'platform_position',label:'Posição'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'ctr',label:'CTR',render:r=>pct(r.ctr)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface>
    </>}

    {tab==='waste'&&<>
      <div className="deep-metric-grid five"><Metric label="Exposição investigável" value={money(waste?.summary?.estimated_total)}/><Metric label="Público × criativo" value={integer(waste?.summary?.counts?.audience_mismatch)}/><Metric label="Placement × criativo" value={integer(waste?.summary?.counts?.placement_mismatch)}/><Metric label="Atenção" value={integer(waste?.summary?.counts?.attention)}/><Metric label="Pós-clique" value={integer(waste?.summary?.counts?.post_click)}/></div>
      <SectionHeader number="01" eyebrow="DESPERDÍCIOS" title="Onde investigar perda de eficiência" description="A exposição é uma triagem. O próximo passo deve considerar amostra, estágio do funil e contexto do criativo."/>
      <div className="deep-two"><HorizontalBars title="Maiores exposições" rows={(waste.items||[]).map((x,i)=>({key:x.creative_name||x.ad_name||x.type||`Item ${i+1}`,estimated_waste:x.estimated_waste}))} valueKey="estimated_waste" formatValue={money}/><Surface eyebrow="LEITURA" title="Como interpretar"><div className="deep-checks"><p>✓ Atenção baixa sugere investigar hook, thumb, headline ou encaixe com o público.</p><p>✓ Pós-clique ruim pede investigação de landing, oferta, preço, checkout ou tracking.</p><p>✓ Público/placement deve ser avaliado junto do criativo antes de cortar.</p></div></Surface></div>
      <Surface eyebrow="DETALHE" title="Sinais classificados"><DataTable rows={waste.items||[]} columns={[{key:'type',label:'Tipo'},{key:'creative_name',label:'Criativo'},{key:'ad_name',label:'Anúncio'},{key:'estimated_waste',label:'Exposição',render:r=>money(r.estimated_waste)},{key:'reason',label:'Diagnóstico'},{key:'action',label:'Próximo passo'}]}/></Surface>
    </>}
  </div>
}
