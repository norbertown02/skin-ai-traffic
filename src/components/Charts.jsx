import React, { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

const baseGrid = 'rgba(77,31,89,.07)'
const tick = '#847985'

export function ChartCard({ title, subtitle, labels, datasets, type = 'line', height = 280, options = {}, eyebrow = 'EVOLUÇÃO' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const instance = new Chart(ref.current, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { usePointStyle: true, boxWidth: 8, color: '#6f626d', font: { size: 11, family: 'Inter' } } },
          tooltip: { padding: 13, cornerRadius: 2, backgroundColor: '#321238', titleFont: { family: 'Inter', weight: '600' }, bodyFont: { family: 'Inter' } },
        },
        scales: {
          x: { border: { display: false }, grid: { display: false }, ticks: { color: tick, font: { size: 10, family: 'Inter' }, maxRotation: 0 } },
          y: { border: { display: false }, grid: { color: baseGrid }, ticks: { color: tick, font: { size: 10, family: 'Inter' } } },
        },
        ...options,
      },
    })
    return () => instance.destroy()
  }, [JSON.stringify(labels), JSON.stringify(datasets), JSON.stringify(options), type])
  return <section className="surface chart-card">
    <div className="surface-head"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div>
    <div className="chart-frame" style={{ height }}><canvas ref={ref} /></div>
  </section>
}

export function HorizontalBars({ title, subtitle, rows, valueKey = 'spend', labelKey = 'key', formatValue = (v) => Number(v || 0).toLocaleString('pt-BR'), limit = 7 }) {
  const clean = (rows || []).slice().sort((a, b) => Number(b[valueKey] || 0) - Number(a[valueKey] || 0)).slice(0, limit)
  const max = Math.max(1, ...clean.map(r => Number(r[valueKey] || 0)))
  return <section className="surface bars-card"><div className="surface-head"><div><span className="eyebrow">BREAKDOWN</span><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div><div className="bar-list">{clean.map((row, index) => <div className="bar-row" key={`${row[labelKey]}-${index}`}><div className="bar-row-top"><span>{row[labelKey] || '—'}</span><strong>{formatValue(row[valueKey])}</strong></div><div className="bar-track"><div style={{ width: `${Math.max(2, Number(row[valueKey] || 0) / max * 100)}%` }} /></div></div>)}</div></section>
}

export function RetentionChart({ retention, height = 220 }) {
  const ref = useRef(null)
  const data = [100, retention?.p25 || 0, retention?.p50 || 0, retention?.p75 || 0, retention?.p95 || 0, retention?.p100 || 0]
  useEffect(() => {
    if (!ref.current) return
    const instance = new Chart(ref.current, {
      type: 'line',
      data: { labels: ['Start', '25%', '50%', '75%', '95%', '100%'], datasets: [{ data, borderColor: '#4d1f59', backgroundColor: 'rgba(77,31,89,.07)', fill: true, borderWidth: 2.5, tension: .35, pointRadius: 2.5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#321238', cornerRadius: 2 } }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: tick, font: { size: 10, family: 'Inter' } } }, y: { border: { display: false }, min: 0, max: 100, grid: { color: baseGrid }, ticks: { color: tick, callback: v => `${v}%`, font: { size: 10, family: 'Inter' } } } } },
    })
    return () => instance.destroy()
  }, [JSON.stringify(data)])
  return <div className="retention-chart" style={{ height }}><canvas ref={ref}/></div>
}
