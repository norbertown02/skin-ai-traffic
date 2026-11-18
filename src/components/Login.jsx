import React, { useState } from 'react'
import { login, sendAccessLink } from '../api.js'

function loginError(error, mode) {
  switch (error?.code) {
    case 'over_email_send_rate_limit':
      return 'O limite de envio de e-mails foi atingido. Aguarde até uma hora antes de solicitar um novo link.'
    case 'over_request_rate_limit':
      return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
    case 'invalid_credentials':
      return 'E-mail ou senha inválidos.'
    case 'otp_expired':
      return 'O link expirou ou já foi usado. Solicite um novo link.'
    case 'otp_disabled':
    case 'user_not_found':
      return 'Confira o e-mail autorizado para acessar o relatório.'
    default:
      if (error?.message?.includes('configurada')) return error.message
      return mode === 'link'
        ? 'Não foi possível enviar o link agora. Tente novamente em instantes.'
        : 'Não foi possível entrar agora. Tente novamente em instantes.'
  }
}

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
      setError(loginError(error, mode))
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
