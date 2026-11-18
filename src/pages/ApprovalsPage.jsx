import React from 'react'
import { PageHeader, Surface } from '../components/UI.jsx'

export default function ApprovalsPage() {
  return <div className="page approvals-page">
    <PageHeader eyebrow="APROVAÇÕES" title="Central de decisões do Gestor IA" />
    <Surface>
      <p className="muted-copy">A fila de decisões do Gestor IA ainda não está conectada à nova base.</p>
    </Surface>
  </div>
}
