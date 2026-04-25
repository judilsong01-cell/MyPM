# MyPME

MyPME e uma aplicacao mobile offline-first para micro e pequenas empresas em Angola.
O produto foi desenhado para registo rapido de vendas, despesas, fiado e controlo operacional basico, com autenticacao por email e sincronizacao cloud quando houver internet.

## O que existe hoje

- Dashboard com resumo diario e mensal
- Registo rapido de vendas e despesas
- Gestao de fiado com atualizacao local imediata
- Base SQLite local para funcionamento offline
- Autenticacao com Appwrite Account (email/senha, Google, telefone OTP)
- Verificacao obrigatoria (email ou telefone) antes de aceder ao dashboard
- Sincronizacao manual para a nuvem
- Branding, splash e icones preparados para Android

## Estrutura

- `src/screens` : experience principal do utilizador
- `src/database` : SQLite local, migracoes e repositorios
- `src/services` : Appwrite, sync e segredos de ambiente
- `src/assets` : branding, icones e ilustracoes
- `android` : build Android, assinatura e release
- `docs` : materiais executivos e de produto
  - `docs/Appwrite.md` : setup + hardening de Appwrite

## Stack

- React Native 0.73.4
- TypeScript 5.0.4
- SQLite local
- Appwrite Account + Databases
- React Navigation
- SVG assets

## Comandos uteis

```bash
npm install
npm start
npm run android
npm run typecheck
```

## Android release

Arquivos principais:

- `android/keystore.properties`
- `android/app/app002-release.keystore`
- `android/app/build.gradle`

Build:

```bat
cd /d C:\Users\judil\Documents\Playground\002\App002\android
gradlew clean
gradlew bundleRelease
```

Saidas:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

## Materiais de investidor

- `docs/MyPME_OnePager.md`
- `docs/investor/README.md`
- `docs/investor/MyPME_Investor_Deck.html`
