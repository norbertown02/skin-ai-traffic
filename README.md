# Skin AI Traffic Manager

Frontend oficial do painel Skin Beauty.

## Arquitetura
- GitHub: código-fonte do frontend
- Vercel: build, preview e produção
- Supabase: banco, autenticação e APIs

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`

## Estado da migração
O frontend está sendo migrado das Edge Functions de UI para uma aplicação React única. As Edge Functions antigas permanecem temporariamente apenas como rollback até a validação completa do novo app.

## Prévia P0

A prévia do Vercel usa a Edge Function `traffic-report-p0-preview`. A função usa o mesmo login e consulta os agregados comerciais da loja vinculada em modo de leitura. A produção continua usando `traffic-report`.

- Executar `node --test tests/*.test.mjs` e `npm run build`.
- Validar na prévia as telas Análise, Executivo, Públicos e Integrações com um usuário autorizado.
- Após aprovação, publicar os três arquivos da função sob o slug `traffic-report` e integrar o PR em `main`. Registrar a versão anterior da função e o deploy anterior para reversão.
- A P0 lê a importação mensal existente. Para diagnosticar UTMs no tráfego realizado, é necessário capturar a URL resolvida ou os parâmetros por visita/pedido em uma integração posterior. A auditoria atual usa os campos disponíveis no catálogo.
