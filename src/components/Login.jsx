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
      <div className="login-brand-row"><div className="brand-symbol large">SB</div><div><strong>Skin Beauty</strong><span>Performance Intelligence</span></div></div>
      <div className="login-copy"><span className="eyebrow light">GESTÃO DE PERFORMANCE</span><h1>No flow da sua performance.</h1><p>Uma leitura única da operação para conectar mídia, comportamento, vendas e decisões de crescimento sem perder a identidade da Skin.</p></div>
      <div className="login-feature-grid"><div><span>01</span><strong>Negócio</strong><p>Receita, pedidos, conversão, MER e eficiência comercial.</p></div><div><span>02</span><strong>Mídia</strong><p>Meta Ads, criativos, públicos, placements e desperdícios.</p></div><div><span>03</span><strong>Decisão</strong><p>Diagnósticos, evidências e próximos passos do Gestor IA.</p></div></div>
    </section>
    <section className="login-form-side"><form className="login-card" onSubmit={submit}><span className="eyebrow">SKIN BEAUTY · ACESSO</span><h2>Bem-vindo.</h2><p>Entre para acompanhar a performance completa da operação.</p><label>Usuário<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label><button className="btn primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar no painel'}</button>{error && <div className="form-error">{error}</div>}<small className="login-footnote">Shopify permanece como verdade comercial. Meta Ads permanece como fonte de mídia e atribuição.</small></form></section>
  </div>
}
