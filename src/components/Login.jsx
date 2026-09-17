import React, { useState } from 'react'
import { login } from '../api.js'

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('user')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    try { await login(username, password); onSuccess?.() }
    catch { setError('Usuário ou senha inválidos.') }
    finally { setLoading(false) }
  }

  return <div className="login-shell">
    <section className="login-visual">
      <div className="login-brand-row"><div className="brand-symbol large">S</div><div><strong>SKIN BEAUTY</strong><span>AI TRAFFIC MANAGER</span></div></div>
      <div className="login-copy"><span className="eyebrow light">INTELIGÊNCIA DE PERFORMANCE</span><h1>Dados que viram<br/>decisões melhores.</h1><p>Meta Ads e Shopify conectados em uma leitura executiva, visual e profunda da operação.</p></div>
      <div className="login-feature-grid"><div><span>01</span><strong>Relatório executivo</strong><p>Negócio, mídia, funil e eficiência em uma visão apresentável.</p></div><div><span>02</span><strong>Gestor IA</strong><p>Diagnóstico, evidência, ação sugerida e validação.</p></div><div><span>03</span><strong>Análise profunda</strong><p>Criativo, público, placement, idade, gênero e desperdício.</p></div></div>
    </section>
    <section className="login-form-side"><form className="login-card" onSubmit={submit}><span className="eyebrow">ACESSO RESTRITO</span><h2>Bem-vindo de volta</h2><p>Acesse a plataforma de gestão de tráfego da Skin Beauty.</p><label>Usuário<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label><button className="btn primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar no painel'}</button>{error && <div className="form-error">{error}</div>}<small className="login-footnote">Dados comerciais Shopify e dados de mídia Meta são mantidos como fontes distintas no relatório.</small></form></section>
  </div>
}
