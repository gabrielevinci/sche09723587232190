# 🔒 Isolamento Vercel-OnlySocial tramite AWS Lambda

## Architettura

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Vercel    │  HTTP   │ AWS Lambda   │  HTTP   │  OnlySocial    │
│  (Next.js)  │────────▶│  (Proxy)     │────────▶│  API           │
└─────────────┘         └──────────────┘         └────────────────┘
      │                        │
      │                        │
      ▼                        ▼
┌─────────────┐         ┌──────────────┐
│   NeonDB    │         │ DigitalOcean │
│ (Database)  │         │   Spaces     │
└─────────────┘         └──────────────┘
```

## 🔑 Variabili d'Ambiente

### ✅ Vercel (Production)
**NON configurare credenziali OnlySocial!**

```env
# NextAuth.js
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://tuo-dominio.vercel.app

# Database
DATABASE_URL=postgresql://...

# AWS Lambda API (ESSENZIALE)
LAMBDA_API_URL=https://sxibldy7k8.execute-api.eu-central-1.amazonaws.com/prod/schedule

# DigitalOcean Spaces
DO_SPACES_ENDPOINT=...
DO_SPACES_BUCKET=...
DO_SPACES_ACCESS_KEY_ID=...
DO_SPACES_SECRET_ACCESS_KEY=...
DO_SPACES_REGION=...

# Cron Security
CRON_SECRET=...
```

### ✅ AWS Lambda
**Solo Lambda deve avere credenziali OnlySocial!**

```env
# OnlySocial API (SOLO LAMBDA)
ONLYSOCIAL_API_KEY=sMzOWqm6BHpc5yyRm6vg0GuwSpYj0fgsi1zx1dVTf111c651
ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d

# Database (per Prisma)
DATABASE_URL=postgresql://...

# DigitalOcean Spaces (per scaricare video)
DO_SPACES_ENDPOINT=...
DO_SPACES_BUCKET=...
DO_SPACES_ACCESS_KEY_ID=...
DO_SPACES_SECRET_ACCESS_KEY=...
DO_SPACES_REGION=...
```

### 🛠️ Sviluppo Locale (.env.local)
Per test locali puoi abilitare credenziali OnlySocial:

```env
# Per sviluppo locale (opzionale)
ONLYSOCIAL_API_KEY=...
ONLYSOCIAL_WORKSPACE_UUID=...

# Lambda URL (per test)
LAMBDA_API_URL=https://sxibldy7k8.execute-api.eu-central-1.amazonaws.com/prod/schedule
```

## 🔄 Flusso delle Chiamate

### 1. Check Status Account (/dashboard)
```
Frontend → GET /api/user/profiles
         → onlysocial-sync.ts
         → Lambda API (POST {action: "check-accounts"})
         → OnlySocial API /accounts
```

### 2. Sync Account (/admin)
```
Frontend → POST /api/admin/sync-accounts
         → Lambda API (POST {action: "check-accounts"})
         → OnlySocial API /accounts
         → Salva in Database
```

### 3. Schedule Post (cron job)
```
Cron-job.org → POST /api/cron/trigger
             → Lambda API (POST {action: "schedule"})
             → Lambda:
                1. Query database per post da schedulare
                2. Download video da DigitalOcean
                3. Upload video a OnlySocial API /media
                4. Crea post OnlySocial API /posts
                5. Schedula post OnlySocial API /schedule
                6. Aggiorna database
```

## ✅ Verifica Isolamento

### Test 1: Vercel NON ha credenziali OnlySocial
```bash
# Su Vercel Production, controlla variabili d'ambiente
# NON devono esserci:
# - ONLYSOCIAL_API_KEY
# - ONLYSOCIAL_WORKSPACE_UUID
```

### Test 2: Lambda ha credenziali OnlySocial
```bash
aws lambda get-function-configuration \
  --function-name onlysocial-scheduler \
  --query 'Environment.Variables'

# Devono esserci:
# - ONLYSOCIAL_API_KEY
# - ONLYSOCIAL_WORKSPACE_UUID
```

### Test 3: Chiamate passano da Lambda
```bash
# Monitora log CloudWatch Lambda
aws logs tail /aws/lambda/onlysocial-scheduler --follow

# Durante operazioni su /dashboard, dovresti vedere:
# [OnlySocial] Fetching accounts...
# [OnlySocial] Found X accounts
```

## 🚨 Sicurezza

### ❌ NON FARE:
- ❌ Configurare `ONLYSOCIAL_API_KEY` su Vercel
- ❌ Chiamare `https://app.onlysocial.io` da Vercel
- ❌ Importare `@/lib/onlysocial` da route Vercel
- ❌ Esporre credenziali OnlySocial nel frontend

### ✅ FARE:
- ✅ Tutte le chiamate OnlySocial passano da Lambda
- ✅ Solo Lambda ha credenziali OnlySocial
- ✅ Vercel ha solo `LAMBDA_API_URL`
- ✅ Frontend non conosce l'esistenza di OnlySocial API

## 📊 Monitoring

### Log Lambda (CloudWatch)
```bash
# Real-time
aws logs tail /aws/lambda/onlysocial-scheduler --follow

# Ultimi 10 minuti
aws logs tail /aws/lambda/onlysocial-scheduler --since 10m

# Cerca errori
aws logs filter-pattern "ERROR" \
  --log-group-name /aws/lambda/onlysocial-scheduler
```

### Verifica Chiamate
Ogni chiamata Lambda dovrebbe loggare:
```
✅ [OnlySocial] Video uploaded - ID: 996955
✅ [OnlySocial] Post created - UUID: 6059e1b3-...
✅ [OnlySocial] Post scheduled: 2025-12-07 04:15:00
```

## 🔧 Troubleshooting

### "Lambda not found" o timeout
1. Verifica `LAMBDA_API_URL` su Vercel
2. Controlla che Lambda sia deployata
3. Verifica API Gateway configuration

### "Unauthorized" da OnlySocial
1. Verifica credenziali su Lambda
2. Controlla che Lambda abbia `ONLYSOCIAL_API_KEY`
3. Verifica che il token non sia scaduto

### Vercel chiama OnlySocial direttamente
1. Rimuovi `ONLYSOCIAL_API_KEY` da Vercel
2. Verifica che `onlysocial-sync.ts` usi `LAMBDA_API_URL`
3. Controlla che nessun file importi `@/lib/onlysocial`

## 📚 File Chiave

- `src/lib/onlysocial-sync.ts` - Sync account via Lambda ✅
- `src/app/api/cron/trigger/route.ts` - Proxy cron a Lambda ✅
- `src/app/api/admin/sync-accounts/route.ts` - Sync admin via Lambda ✅
- `server_lambda/src/index.ts` - Handler Lambda principale
- `server_lambda/src/onlysocial-client.ts` - Client OnlySocial API

---

**Ultima verifica:** 7 Dicembre 2025
**Versione Lambda:** 1.0.0 con fix payload accounts
