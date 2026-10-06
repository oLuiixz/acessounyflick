# UnyFlick — Funil Conversacional

Funil mobile-first em formato de chat para captura de leads e geração de teste.

## Rodar
```bash
npm install
npm run dev
```

## Persistência
Sem `DATABASE_URL`, o MVP usa fallback em memória no servidor. Para produção, configure um Postgres/Neon e execute `schema.sql`.

Variáveis:
- `DATABASE_URL`
- `SIGMA_API_URL`
- `SIGMA_API_KEY`

## Sigma
O endpoint `/api/sigma` usa dados simulados quando as variáveis Sigma não estão preenchidas. Quando preenchidas, a chamada fica isolada em `lib/sigma.ts`, mantendo a credencial no servidor.

## Painel
`/admin` mostra leads, etapa, teste gerado e UTMs.
