import React, { useEffect, useState } from 'react'
import { api, endpoints } from '../api.js'
import { ChartCard, HorizontalBars } from '../components/Charts.jsx'
import { DataTable, PageHeader, SectionHeader, Surface } from '../components/UI.jsx'
import { cleanAdName, integer, money, num, pct } from '../lib/format.js'

const n=v=>Number(v||0)
const sort=(rows,key='spend')=>(rows||[]).slice().sort((a,b)=>n(b[key])-n(a[key]))
function Metric({label,value,note}){return <div className="deep-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}

export default function AnalysisDeep({data}){
  const [range,setRange]=useState('30')
  const [year,setYear]=useState(String(new Date().getFullYear()))
  const [customStart,setCustomStart]=useState('')
  const [customEnd,setCustomEnd]=useState('')
  const [analysis,setAnalysis]=useState(null)
  const [loading,setLoading]=useState(false)
  const [rangeError,setRangeError]=useState('')
  const today=new Date().toISOString().slice(0,10)
  const currentYear=new Date().getFullYear()
  const selectedYear=Number(year)
  const startDate=range==='year' ? `${year}-01-01` : range==='custom' ? customStart : ''
  const endDate=range==='year' ? (selectedYear===currentYear?today:`${year}-12-31`) : range==='custom'?customEnd : today
  const calendarDays=startDate&&endDate ? Math.round((Date.parse(endDate+'T12:00:00Z')-Date.parse(startDate+'T12:00:00Z'))/86400000)+1 : 0
  const days=range==='year'||range==='custom'?calendarDays:Number(range)
  const invalidRange=!!(range==='custom'&&(!customStart||!customEnd||customStart>customEnd||customEnd>today)) || (range==='year'&&selectedYear>currentYear)
  useEffect(()=>{
    if(range==='30'){setAnalysis(null);setRangeError('');setLoading(false);return}
    if(invalidRange||days<1){setAnalysis(null);setRangeError('Selecione um intervalo de datas válido.');return}
    let cancelled=false
    const params=new URLSearchParams({days:String(days)})
    if(startDate){params.set('since',startDate);params.set('until',endDate);params.set('start_date',startDate);params.set('end_date',endDate)}
    const withParams=(url)=>`${url.split('?')[0]}?${url.includes('action=bootstrap')?'action=bootstrap&':''}${params.toString()}`
    setLoading(true);setRangeError('')
    Promise.all([
      api(withParams(endpoints.bootstrap)),
      api(withParams(endpoints.deep)),
      api(withParams(endpoints.audience))
    ]).then(([bootstrap,deep,audience])=>{
      if(cancelled)return
      const daily=bootstrap?.performance?.daily||[]
      const dateValues=daily.map(x=>String(x.date||'').slice(0,10)).filter(Boolean).sort()
      // Do not silently label a 30-day response as an annual report.
      if(startDate&&dateValues.length&&dateValues[0]>startDate){
        setAnalysis(null)
        setRangeError(`A API retornou dados somente a partir de ${dateValues[0]}. O histórico completo solicitado não foi confirmado; é necessário ampliar a consulta no Supabase.`)
      }else setAnalysis({bootstrap,deep,audience})
    }).catch(error=>{if(!cancelled){setAnalysis(null);setRangeError(error.message||'Não foi possível consultar o período selecionado.')}}).finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[range,year,customStart,customEnd])
  const source=analysis||data||{}
  const deep=source.deep||{}, perf=source.bootstrap?.performance||{}, audience=source.audience||{}
  const crossAudience=deep?.cross?.creative_audience||[], crossPlacement=deep?.cross?.creative_placement_set||[], waste=deep?.waste||{}, daily=perf?.daily||[], labels=daily.map(x=>String(x.date||'').slice(5))
  const [tab,setTab]=useState('overview')
  const period=range==='30' ? perf?.periods?.current30||{} : perf?.periods?.current||perf?.periods?.selected||perf?.periods?.current30||{}
  const intervalLabel=range==='year'?`Ano de ${year}`:range==='custom'?`${customStart} a ${customEnd}`:`Últimos ${range} dias`
  const topAudience=sort(crossAudience,'spend').slice(0,12), topPlacement=sort(crossPlacement,'spend').slice(0,12)
  const bestAge=sort((audience.by_age||[]).filter(x=>n(x.spend)>0),'roas')[0]
  const bestGender=sort((audience.by_gender||[]).filter(x=>n(x.spend)>0),'roas')[0]
  const tabs=[['overview','Visão geral'],['audience','Público × criativo'],['placement','Placement × criativo'],['waste','Desperdícios']]
  const creativeName=v=>cleanAdName(v,'Criativo')

  return <div className="page deep-page analysis-deep">
    <PageHeader eyebrow="ANÁLISE DETALHADA" title="Central de investigação" description="Aprofunda o que o relatório executivo apontou: leilão, atenção, qualidade do clique, público, placement, criativo e fundo de funil."/>
    <div className="analysis-period-filter" style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',padding:'14px 0'}}>
      <label>Período <select value={range} onChange={e=>setRange(e.target.value)}>
        <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
        <option value="180">Últimos 6 meses</option><option value="year">Ano inteiro</option><option value="custom">Personalizado</option>
      </select></label>
      {range==='year'&&<label>Ano <select value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:5},(_,i)=>currentYear-i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>}
      {range==='custom'&&<><label>Início <input type="date" value={customStart} max={today} onChange={e=>setCustomStart(e.target.value)}/></label><label>Fim <input type="date" value={customEnd} max={today} onChange={e=>setCustomEnd(e.target.value)}/></label></>}
      <small>{intervalLabel}</small>
    </div>
    {loading&&<p role="status">Consultando dados do período selecionado…</p>}
    {rangeError&&<p role="alert" style={{color:'#9d3a43',fontWeight:600}}>{rangeError}</p>}
    {!loading&&rangeError&&<p>Os indicadores abaixo continuam exibindo o último período válido; não representam o intervalo solicitado.</p>}
    <div className="tabs deep-tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</div>

    {tab==='overview'&&<>
      <div className="deep-metric-grid six"><Metric label="CPM" value={money(period.cpm)} note="pressão de leilão"/><Metric label="CPC" value={money(period.link_cpc||period.cpc)} note="custo de tráfego"/><Metric label="CTR" value={pct(period.link_ctr||period.ctr)} note="atenção"/><Metric label="LPV rate" value={pct(period.lpv_rate)} note="qualidade do clique"/><Metric label="ROAS" value={num(period.roas)} note="atribuição Meta"/><Metric label="Anomalia" value={`${integer(perf?.anomaly?.score||0)}/100`} note="sinal agregado"/></div>
      <SectionHeader number="01" eyebrow="DINÂMICA" title="Leilão, atenção e pós-clique" description="O objetivo é identificar onde a deterioração começa: antes do clique, na chegada à página ou no fundo do funil."/>
      <div className="deep-two"><ChartCard title="CPM × CPC" subtitle="Leilão e custo de tráfego" labels={labels} datasets={[{label:'CPM',data:daily.map(x=>n(x.cpm)),borderColor:'#48205d',backgroundColor:'rgba(72,32,93,.08)',fill:true,borderWidth:2.5,tension:.35,pointRadius:1.5},{label:'CPC',data:daily.map(x=>n(x.link_cpc||x.cpc)),borderColor:'#a786af',borderWidth:2,tension:.35,pointRadius:1.5}]} height={310}/><ChartCard title="CTR × LPV rate" subtitle="Atenção versus qualidade do clique" labels={labels} datasets={[{label:'CTR',data:daily.map(x=>n(x.link_ctr||x.ctr)),borderColor:'#557866',backgroundColor:'rgba(85,120,102,.08)',fill:true,borderWidth:2.5,tension:.35,pointRadius:1.5},{label:'LPV rate',data:daily.map(x=>n(x.lpv_rate)),borderColor:'#a786af',borderWidth:2,tension:.35,pointRadius:1.5}]} height={310}/></div>
      <SectionHeader number="02" eyebrow="AUDIÊNCIA" title="Quem recebe verba e quem devolve resultado" description="Distribuição de gasto e compra por idade para encontrar concentração ou oportunidades de teste."/>
      <div className="deep-two"><HorizontalBars title="Gasto por idade" subtitle={intervalLabel} rows={audience.by_age||[]} valueKey="spend" formatValue={money}/><HorizontalBars title="Compras por idade" subtitle={intervalLabel} rows={audience.by_age||[]} valueKey="purchases" formatValue={integer}/></div>
      <div className="analysis-highlight-row"><Surface eyebrow="FAIXA ETÁRIA" title="Melhor retorno"><strong className="analysis-big">{bestAge?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestAge?.roas)} · CAC {money(bestAge?.cac)} · {integer(bestAge?.purchases)} compras</p></Surface><Surface eyebrow="GÊNERO" title="Melhor eficiência"><strong className="analysis-big">{bestGender?.key||'—'}</strong><p className="muted-copy">ROAS {num(bestGender?.roas)} · CAC {money(bestGender?.cac)}</p></Surface><Surface eyebrow="DESPERDÍCIO" title="Exposição potencial"><strong className="analysis-big">{money(waste?.summary?.estimated_total)}</strong><p className="muted-copy">Sinal investigável, não verba automaticamente cortável.</p></Surface></div>
    </>}

    {tab==='audience'&&<>
      <SectionHeader number="01" eyebrow="PÚBLICO × CRIATIVO" title="A peça certa para a audiência certa" description="O mesmo criativo pode ser vencedor em um público e fraco em outro. Aqui a análise sai do agregado."/>
      <div className="deep-two"><HorizontalBars title="Maior gasto por combinação" rows={topAudience.map((x,i)=>({key:`${creativeName(x.creative_name)} · ${x.audience_type||x.ad_set_name||'Público'}`,spend:x.spend}))} valueKey="spend" formatValue={money}/><HorizontalBars title="Maior ROAS por combinação" rows={sort(crossAudience.filter(x=>n(x.spend)>=20),'roas').slice(0,10).map(x=>({key:`${creativeName(x.creative_name)} · ${x.audience_type||x.ad_set_name||'Público'}`,roas:x.roas}))} valueKey="roas" formatValue={num}/></div>
      <Surface eyebrow="DETALHE" title="Todas as combinações relevantes"><DataTable rows={sort(crossAudience,'spend').slice(0,80)} columns={[{key:'creative_name',label:'Criativo',render:r=>creativeName(r.creative_name)},{key:'ad_set_name',label:'Conjunto'},{key:'audience_type',label:'Público'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'ctr',label:'CTR',render:r=>pct(r.ctr)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface>
    </>}

    {tab==='placement'&&<>
      <SectionHeader number="01" eyebrow="PLACEMENT × CRIATIVO" title="Onde cada peça funciona melhor" description="Feed, Stories, Reels, Explore e plataforma vistos pelo conjunto peça + contexto, não apenas pela média."/>
      <div className="deep-two"><HorizontalBars title="Maior gasto por combinação" rows={topPlacement.map(x=>({key:`${creativeName(x.creative_name)} · ${x.publisher_platform||''} ${x.platform_position||''}`,spend:x.spend}))} valueKey="spend" formatValue={money}/><HorizontalBars title="Maior ROAS por combinação" rows={sort(crossPlacement.filter(x=>n(x.spend)>=20),'roas').slice(0,10).map(x=>({key:`${creativeName(x.creative_name)} · ${x.publisher_platform||''} ${x.platform_position||''}`,roas:x.roas}))} valueKey="roas" formatValue={num}/></div>
      <Surface eyebrow="DETALHE" title="Combinações de entrega"><DataTable rows={sort(crossPlacement,'spend').slice(0,80)} columns={[{key:'creative_name',label:'Criativo',render:r=>creativeName(r.creative_name)},{key:'publisher_platform',label:'Plataforma'},{key:'platform_position',label:'Posição'},{key:'spend',label:'Gasto',render:r=>money(r.spend)},{key:'ctr',label:'CTR',render:r=>pct(r.ctr)},{key:'purchases',label:'Compras',render:r=>integer(r.purchases)},{key:'cac',label:'CAC',render:r=>money(r.cac)},{key:'roas',label:'ROAS',render:r=>num(r.roas)}]}/></Surface>
    </>}

    {tab==='waste'&&<>
      <div className="deep-metric-grid five"><Metric label="Exposição investigável" value={money(waste?.summary?.estimated_total)}/><Metric label="Público × criativo" value={integer(waste?.summary?.counts?.audience_mismatch)}/><Metric label="Placement × criativo" value={integer(waste?.summary?.counts?.placement_mismatch)}/><Metric label="Atenção" value={integer(waste?.summary?.counts?.attention)}/><Metric label="Pós-clique" value={integer(waste?.summary?.counts?.post_click)}/></div>
      <SectionHeader number="01" eyebrow="DESPERDÍCIOS" title="Onde investigar perda de eficiência" description="A exposição é uma triagem. O próximo passo deve considerar amostra, estágio do funil e contexto do criativo."/>
      <div className="deep-two"><HorizontalBars title="Maiores exposições" rows={(waste.items||[]).map((x,i)=>({key:x.creative_name?creativeName(x.creative_name):x.ad_name?cleanAdName(x.ad_name):x.type||`Item ${i+1}`,estimated_waste:x.estimated_waste}))} valueKey="estimated_waste" formatValue={money}/><Surface eyebrow="LEITURA" title="Como interpretar"><div className="deep-checks"><p>✓ Atenção baixa sugere investigar hook, thumb, headline ou encaixe com o público.</p><p>✓ Pós-clique ruim pede investigação de landing, oferta, preço, checkout ou tracking.</p><p>✓ Público/placement deve ser avaliado junto do criativo antes de cortar.</p></div></Surface></div>
      <Surface eyebrow="DETALHE" title="Sinais classificados"><DataTable rows={waste.items||[]} columns={[{key:'type',label:'Tipo'},{key:'creative_name',label:'Criativo',render:r=>cleanAdName(r.creative_name,'—')},{key:'ad_name',label:'Anúncio',render:r=>cleanAdName(r.ad_name,'—')},{key:'estimated_waste',label:'Exposição',render:r=>money(r.estimated_waste)},{key:'reason',label:'Diagnóstico'},{key:'action',label:'Próximo passo'}]}/></Surface>
    </>}
  </div>
}
