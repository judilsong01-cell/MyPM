# MyPME - Ficha Tecnica do Produto

## Produto

- Nome comercial: MyPME
- Plataforma atual: Android
- Tipo: aplicacao mobile offline-first para controlo operacional e financeiro
- Mercado alvo inicial: micro e pequenas empresas em Angola

## Stack mobile

- React Native 0.73.4
- TypeScript 5.0.4
- React Navigation 6
- SQLite local via `react-native-sqlite-storage`
- Appwrite (SDK JS) para autenticacao e base remota
- SVG assets

## Stack backend em construcao

- Node.js
- Express
- Prisma
- PostgreSQL
- JWT

## Modulos existentes no mobile

- onboarding e autenticacao
- dashboard com resumo do negocio
- registo de vendas e despesas
- gestao de fiado
- base de produtos e stock
- sincronizacao manual
- limpeza de dados locais por seguranca ao trocar de conta

## Arquitetura local

- base SQLite `mypme.db`
- migracoes locais para `transactions`, `debts`, `products`, `business`, `sync_queue`
- campos de sincronizacao como `remote_id`, `user_id`, `updated_at`, `synced`

## Arquitetura cloud

- Appwrite Account (email/senha, Google, telefone OTP) com verificacao obrigatoria
- Appwrite Databases para persistencia remota com isolamento por utilizador (permissoes por documento)
- backend fintech separado para API REST profissional e futura integracao com bancos

## Estado do produto

- base funcional demonstravel
- Android release ja gerado
- identidade visual aplicada
- modulo de inventario ainda em consolidacao visual
- sync precisa de reforco para cenarios mais exigentes e multi-dispositivo

## Principais ativos

- app mobile instalada e demonstravel
- branding proprietario
- base offline-first pronta
- backend fintech inicial
- documentacao comercial e tecnica
