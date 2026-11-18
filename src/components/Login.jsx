import React, { useState } from 'react'
import { login, sendAccessLink } from '../api.js'

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState('link')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(''); setNotice('')
    try {
      if (mode === 'password') {
        await login(email.trim(), password)
        onSuccess?.()
      } else {
        await sendAccessLink(email.trim())
        setNotice('Confira seu e-mail para abrir o link de acesso.')
      }
    } catch (error) {
      setError(error.message.includes('configurada') ? error.message : 'Não foi possível entrar. Confira se o e-mail tem acesso ao relatório.')
    }
    finally { setLoading(false) }
  }

  return <div className="login-shell">
    <section className="login-visual">
      <div className="login-brand-row"><div className="brand-symbol large">SB</div><div><strong>Skin Beauty</strong><span>Performance Intelligence</span></div></div>
      <div className="login-copy"><span className="eyebrow light">GESTÃO DE PERFORMANCE</span><h1>No flow da sua performance.</h1><p>Uma leitura única da operação para conectar mídia, comportamento, vendas e decisões de crescimento sem perder a identidade da Skin.</p></div>
      <div className="login-feature-grid"><div><span>01</span><strong>Negócio</strong><p>Receita, pedidos, conversão, MER e eficiência comercial.</p></div><div><span>02</span><strong>Mídia</strong><p>Meta Ads, criativos, públicos, placements e desperdícios.</p></div><div><span>03</span><strong>Decisão</strong><p>Diagnósticos, evidências e próximos passos do Gestor IA.</p></div></div>
    </section>
    <section className="login-form-side">
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">SKIN BEAUTY · ACESSO</span>
        <h2>Bem-vindo.</h2>
        <p>Entre com seu e-mail autorizado para acessar o relatório.</p>
        <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></label>
        {mode === 'password' && <label>Senha<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" /></label>}
        <button className="btn primary login-submit" disabled={loading}>{loading ? 'Aguarde…' : mode === 'password' ? 'Entrar' : 'Receber link de acesso'}</button>
        <button className="btn" type="button" onClick={()=>{setMode(mode === 'password' ? 'link' : 'password');setNotice('');setError('')}}>{mode === 'password' ? 'Entrar com link' : 'Entrar com senha'}</button>
        {notice && <p role="status">{notice}</p>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </section>
  </div>
}
