import React from 'react'
import { integer, money, num, delta } from '../lib/format.js'
import { Surface } from './UI.jsx'

const day = value => value?.split('-').reverse().join('/') ?? '—'
const windowLabel = period => day(period.start) + ' a ' + day(period.end)
const indicators = [
  ['Investimento', 'spend', money], ['Compras atribuídas', 'purchases', integer],
  ['Receita atribuída', 'revenue', money], ['ROAS Meta', 'roas', num],
]

export default function PeriodComparison({ data }) {
  const { main, performance } = data?.bootstrap ?? {}
  const comparison = performance?.comparison
  if (!comparison) return null
  return <Surface title="Comparação de períodos" eyebrow="META ADS">
    <p>Atual {windowLabel(main.period)} · {comparison.days} dias</p>
    <p>Anterior {windowLabel(comparison)} · {comparison.days} dias</p>
    {!comparison.available ? <p role="status">A janela anterior tem cobertura insuficiente para calcular a variação.</p> :
      <div className="table-wrap"><table><thead><tr><th>Indicador</th><th>Atual</th><th>Anterior</th><th>Variação</th></tr></thead>
        <tbody>{indicators.map(([label,key,format])=>{
          const current = performance.periods.current?.[key]
          const previous = performance.periods.previous?.[key]
          const change = current == null || previous == null ? null : delta(current,previous)
          return <tr key={key}><th scope="row">{label}</th>
            <td>{current == null ? '—' : format(current)}</td><td>{previous == null ? '—' : format(previous)}</td>
            <td>{change == null ? '—' : `${change > 0 ? '+' : ''}${num(change,1)}%`}</td></tr>
        })}</tbody></table></div>}
  </Surface>
}
