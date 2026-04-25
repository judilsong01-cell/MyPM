# Appwrite (Auth + Databases) - Setup e Hardening

Este projeto usa Appwrite para autenticacao e persistencia remota, mantendo SQLite local para operacao offline-first.

## 1) Configuracao no Console

### Projeto e plataformas

1. Cria um projeto no Appwrite Console.
2. Adiciona plataformas:
   - Android: `applicationId` = `com.judilson.mypme`
   - iOS: bundle id do target (ex: `com.judilson.mypme`)

### Autenticacao

Ativa e configura:

- Email + Password
- Google OAuth
- Phone (OTP por SMS), se disponivel no teu ambiente Appwrite

Requisito do app:
- O utilizador so entra no dashboard se `emailVerification == true` OU `phoneVerification == true`.

### Databases / Collections

Cria 1 database (ex: `mypme`) e 3 collections:

- `transactions`
- `debts`
- `products`

Em cada collection:

- Ativa **Document Security**
- Define atributos (campos) pelo menos:
  - `userId` (string, required)

Campos sugeridos (alinhados com `src/services/sync.ts`):

- `transactions`:
  - `userId` (string)
  - `type` (string)
  - `amount` (double/float)
  - `category` (string)
  - `description` (string, optional)
  - `clientName` (string, optional)
  - `paymentMethod` (string)
  - `date` (string, YYYY-MM-DD)
  - `receiptUri` (string, optional)
  - `createdAt` (string, ISO)
  - `updatedAt` (string, ISO)
- `debts`:
  - `userId` (string)
  - `clientName` (string)
  - `clientPhone` (string, optional)
  - `amount` (double/float)
  - `description` (string)
  - `serviceDate` (string, YYYY-MM-DD)
  - `dueDate` (string, optional)
  - `status` (string)
  - `paidAmount` (double/float)
  - `notes` (string, optional)
  - `createdAt` (string, ISO)
  - `updatedAt` (string, ISO)
- `products`:
  - `userId` (string)
  - `name` (string)
  - `category` (string, optional)
  - `costPrice` (double/float)
  - `sellPrice` (double/float)
  - `quantity` (double/float)
  - `minQuantity` (double/float)
  - `unit` (string)
  - `barcode` (string, optional)
  - `photoUri` (string, optional)
  - `createdAt` (string, ISO)
  - `updatedAt` (string, ISO)

## 2) Permissoes (Critico)

Objetivo: negar tudo por defeito e permitir apenas o utilizador autenticado e verificado a aceder aos seus proprios documentos.

Recomendacao:

1. **Collection-level permissions**
   - `create`: `users("verified")` (ou equivalente no teu Console)
   - `read/update/delete`: vazio (sem acesso global)

2. **Document-level permissions**
   - No cliente, cada documento e criado/atualizado com:
     - `read`: `user:{userId}/verified`
     - `update`: `user:{userId}/verified`
     - `delete`: `user:{userId}/verified`

Nota: o `sync.ts` usa `Role.user(userId, "verified")` para impedir que utilizadores nao verificados criem ou acedam a documentos mesmo que tentem bypassar a UI.

## 3) Config do App (secrets)

1. Copia `src/services/appwrite.secrets.example.ts` para `src/services/appwrite.secrets.ts`
2. Preenche:
   - `APPWRITE_ENDPOINT`
   - `APPWRITE_PROJECT_ID`
   - `APPWRITE_DATABASE_ID`
   - `APPWRITE_COLLECTIONS.*`
   - `APPWRITE_AUTH_REDIRECT_URL`

### Redirect URL (Email verification + Google OAuth)

O Appwrite vai redirecionar para `APPWRITE_AUTH_REDIRECT_URL` com query params `userId` e `secret`.

O app trata isto automaticamente via `src/auth/AuthContext.tsx` (listener de deep links).

Em ambientes mobile, normalmente precisas de:
- um URL https permitido no Appwrite (plataformas), e
- uma pagina simples que redireciona para um deep link do app (Android App Links / iOS Universal Links),
  ou configurar um deep link direto se o teu ambiente Appwrite permitir.

## 4) Guardas de rota (Frontend)

- `src/navigation/AppNavigator.tsx` decide:
  - `unauthenticated` -> `AuthScreen`
  - `unverified` -> `VerifyScreen`
  - `authenticated` -> `MainTabs`

Nota: por hardening, `src/auth/AuthContext.tsx` valida a sessao via rede. Sem internet, o app nao concede acesso ao dashboard.

## 5) Sync (Backend Appwrite)

- `src/services/sync.ts`:
  - valida sessao com `appwriteAccount.get()`
  - exige utilizador verificado
  - faz `upsertDocument` e puxa delta por `$updatedAt`

## 6) Backend externo (opcional)

Se tiveres uma API propria (Node/Express, etc.):
- Faz rate limiting no endpoint de login e endpoints protegidos
- Valida JWT do Appwrite em cada request (gerado a partir da sessao)
- Faz validacao/sanitizacao de inputs (Zod/Joi)
- Loga eventos de autenticacao no servidor

Ver exemplo em `docs/appwrite-protected-api-middleware.example.md`.
