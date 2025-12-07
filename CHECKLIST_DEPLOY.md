# ✅ Checklist Deploy: Isolamento Vercel-OnlySocial

## 🎯 Obiettivo
Garantire che **Vercel NON chiami mai OnlySocial direttamente**, ma passi sempre da AWS Lambda.

---

## 📋 Checklist

### 1. ✅ Codice Sorgente
- [x] Fix payload OnlySocial: `accounts: [accountId]` e `account_id: 0`
- [x] `onlysocial-sync.ts` usa `LAMBDA_API_URL`
- [x] Nessun file Vercel importa `@/lib/onlysocial`
- [x] Lambda compilata e `lambda.zip` creato (28.36 MB)

### 2. 🔒 Variabili d'Ambiente VERCEL

**RIMUOVI queste variabili da Vercel Production:**
- [ ] Vai su: https://vercel.com/tuo-team/tuo-progetto/settings/environment-variables
- [ ] **ELIMINA:** `ONLYSOCIAL_API_KEY`
- [ ] **ELIMINA:** `ONLYSOCIAL_WORKSPACE_UUID`

**AGGIUNGI questa variabile su Vercel Production:**
- [ ] **Nome:** `LAMBDA_API_URL`
- [ ] **Valore:** `https://sxibldy7k8.execute-api.eu-central-1.amazonaws.com/prod/schedule`
- [ ] **Environment:** Production, Preview, Development (tutti)

**Variabili che DEVONO rimanere su Vercel:**
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `DATABASE_URL`
- [ ] `DO_SPACES_ENDPOINT`
- [ ] `DO_SPACES_BUCKET`
- [ ] `DO_SPACES_ACCESS_KEY_ID`
- [ ] `DO_SPACES_SECRET_ACCESS_KEY`
- [ ] `DO_SPACES_REGION`
- [ ] `CRON_SECRET`

### 3. ☁️ AWS Lambda

**VERIFICA variabili d'ambiente Lambda:**
- [ ] Vai su: https://eu-central-1.console.aws.amazon.com/lambda/home?region=eu-central-1#/functions/onlysocial-scheduler
- [ ] Tab **Configuration** → **Environment variables**
- [ ] **DEVE avere:**
  - `ONLYSOCIAL_API_KEY` = `sMzOWqm6BHpc5yyRm6vg0GuwSpYj0fgsi1zx1dVTf111c651`
  - `ONLYSOCIAL_WORKSPACE_UUID` = `1d59b252-887e-4a8e-be52-6cafdf3dae2d`
  - `DATABASE_URL` = `postgresql://neondb_owner:npg_lgR4aKWEdr0Z@ep-dry-union-a-foh4cqc.us-west-2.aws.neon.tech/neondb?sslmode=require`
  - `DO_SPACES_ENDPOINT` = `https://lon1.digitaloceanspaces.com`
  - `DO_SPACES_BUCKET` = `scheduler-0chiacchiere`
  - `DO_SPACES_ACCESS_KEY_ID` = `DO00KAQBTJ2CLPP6J8RM`
  - `DO_SPACES_SECRET_ACCESS_KEY` = `+IhvslpUL408MqeRA8+JVD0edH9OZU2R1zMTWXozY7k`
  - `DO_SPACES_REGION` = `lon1`

**UPLOAD lambda.zip:**
- [ ] Tab **Code** → **Upload from** → **.zip file**
- [ ] Seleziona: `d:\Desktop\ONLYSOCIAL\server_lambda\lambda.zip`
- [ ] Clicca **Save**
- [ ] Attendi aggiornamento (~1-2 minuti)

### 4. 🧪 Test Post-Deploy

**Test 1: Dashboard (/dashboard) - Check Account Status**
- [ ] Vai su `/dashboard` del tuo Vercel
- [ ] Apri DevTools → Network tab
- [ ] Verifica che ci sia chiamata a `/api/user/profiles`
- [ ] **NON deve esserci chiamata a `app.onlysocial.io`**
- [ ] Apri CloudWatch Logs Lambda
- [ ] **DEVE apparire log:** `📡 [OnlySocial] Fetching accounts...`

**Test 2: Admin Sync (/admin) - Sync Accounts**
- [ ] Vai su `/admin` (se hai questa pagina)
- [ ] Clicca "Sync Accounts" (o equivalente)
- [ ] Apri DevTools → Network tab
- [ ] Verifica che ci sia chiamata a `/api/admin/sync-accounts`
- [ ] **NON deve esserci chiamata a `app.onlysocial.io`**
- [ ] Apri CloudWatch Logs Lambda
- [ ] **DEVE apparire log:** `📡 [OnlySocial] Fetching accounts...`

**Test 3: Cron Job - Schedule Post**
- [ ] Pianifica un post per tra 2 ore
- [ ] Aspetta che il cron job di cron-job.org si attivi (ogni ora)
- [ ] Apri CloudWatch Logs Lambda
- [ ] **DEVE apparire:**
  ```
  📹 [Lambda] Processing video 1/1
  ✅ [OnlySocial] Video uploaded - ID: 996955
  📝 [OnlySocial] Creating post for account ID 58307
  ✅ [OnlySocial] Post created - UUID: abc123...
  ✅ [OnlySocial] Post scheduled: 2025-12-07 04:15:00
  ```

### 5. 🔍 Verifica Isolamento

**Vercel Production - Variabili NON devono esistere:**
```bash
# Controlla su Vercel Dashboard che NON ci siano:
ONLYSOCIAL_API_KEY ❌
ONLYSOCIAL_WORKSPACE_UUID ❌
```

**Vercel Production - Variabile DEVE esistere:**
```bash
# Controlla su Vercel Dashboard che ci sia:
LAMBDA_API_URL ✅
```

**Lambda CloudWatch - Log DEVONO apparire:**
```bash
# Monitora in tempo reale:
aws logs tail /aws/lambda/onlysocial-scheduler --follow

# Quando usi /dashboard o cron job, DEVONO apparire log Lambda
```

### 6. 🚀 Deploy Finale

**Vercel:**
- [ ] Vai su Vercel Dashboard
- [ ] Fai redeploy dopo aver modificato variabili:
  - Settings → Environment Variables → Salva
  - Deployments → Latest → ⋮ → Redeploy

**Lambda:**
- [ ] Upload `lambda.zip` completato
- [ ] Test function con "Test" button
- [ ] Verifica log non hanno errori Prisma

---

## ✅ Test di Successo

Se tutto funziona correttamente, dovresti vedere:

1. **Dashboard Vercel:**
   - Carica lista account senza errori
   - DevTools NON mostra chiamate a `onlysocial.io`

2. **CloudWatch Lambda:**
   - Ogni operazione (dashboard, sync, cron) appare nei log
   - Log mostrano chiamate a OnlySocial API
   - Nessun errore 422 o Prisma

3. **Database:**
   - Account sincronizzati con `isActive` corretto
   - Post schedulati con status "scheduled"

---

## ❌ Troubleshooting

### Errore: "LAMBDA_API_URL not defined"
→ Aggiungi variabile su Vercel e redeploy

### Errore: "Unauthorized" da Lambda
→ Verifica credenziali OnlySocial su Lambda

### Vercel chiama ancora OnlySocial direttamente
→ Verifica che hai rimosso `ONLYSOCIAL_API_KEY` da Vercel

### Lambda non risponde
→ Verifica che `lambda.zip` sia stato uploadato
→ Controlla timeout Lambda (deve essere almeno 30s)

---

## 📝 Note Finali

**Dopo aver completato la checklist:**
1. Testa /dashboard per 5 minuti
2. Monitora CloudWatch per verificare chiamate Lambda
3. Aspetta il prossimo cron job (ogni ora)
4. Verifica che il post venga schedulato correttamente

**Se tutti i test passano: isolamento completo raggiunto! ✅**
