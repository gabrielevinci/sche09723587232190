# 🚀 Setup Vercel Environment Variables

## ⚠️ AZIONE RICHIESTA

Devi configurare il `CRON_SECRET` su Vercel per far funzionare il cron job endpoint.

## 📋 Passi da seguire

### 1. Vai su Vercel Dashboard
```
https://vercel.com/dashboard
```

### 2. Seleziona il progetto
```
sche09723587232190
```

### 3. Vai in Settings → Environment Variables

### 4. Aggiungi questa variabile

**Nome:**
```
CRON_SECRET
```

**Valore:**
```
b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2
```

**Scope:** 
- ✅ Production
- ✅ Preview
- ✅ Development

### 5. Salva e Redeploy

Clicca "Save" e poi vai su:
```
Deployments → Latest Deployment → ... → Redeploy
```

## 🧪 Test Endpoint Cron

Dopo il deploy, testa l'endpoint:

### Test 1: GET (verifica che funzioni)
```bash
curl https://sche09723587232190.vercel.app/api/cron/process-pending-videos
```

**Risposta attesa:**
```json
{
  "status": "ok",
  "message": "Cron endpoint is ready. Use POST with Authorization header.",
  "info": {
    "frequency": "Every 10 minuti",
    "action": "Process videos scheduled within 1 hour"
  }
}
```

### Test 2: POST con autenticazione
```bash
curl -X POST https://sche09723587232190.vercel.app/api/cron/process-pending-videos \
  -H "Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2"
```

**Risposta attesa (se non ci sono video da processare):**
```json
{
  "success": true,
  "summary": {
    "total": 0,
    "processed": 0,
    "failed": 0
  },
  "errors": []
}
```

## 🕒 Setup cron-job.org

### 1. Vai su https://cron-job.org/en/

### 2. Login/Registrati

### 3. Crea nuovo cron job con questi parametri:

**Title:**
```
OnlySocial Smart Scheduling
```

**URL:**
```
https://sche09723587232190.vercel.app/api/cron/process-pending-videos
```

**HTTP Method:**
```
POST
```

**Headers:**
```
Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2
```

**Schedule (Cron Expression):**
```
*/10 * * * *
```
(Ogni 10 minuti)

**Time Zone:**
```
Europe/Rome
```

**Enable notifications:** ✅

**Send email if job fails:** (inserisci la tua email)

### 4. Salva e testa

Clicca "Save" e poi "Run now" per testare manualmente.

## ✅ Verifiche finali

### Checklist:
- [ ] CRON_SECRET configurato su Vercel
- [ ] Deploy completato su Vercel
- [ ] Test GET endpoint: risponde correttamente
- [ ] Test POST endpoint: risponde 200 OK
- [ ] Cron job configurato su cron-job.org
- [ ] Cron job testato manualmente: success
- [ ] Email notifiche configurate

## 📊 Monitoraggio

### Log Vercel:
```
Dashboard → Your Project → Functions → Logs
```

Cerca:
- `🔄 Cron job started`
- `📊 Found X videos to process`
- `✅ Cron job completed`

### Log cron-job.org:
```
Dashboard → Your Cron Job → Execution History
```

Verifica:
- Status: 200 OK
- Response time: < 30s
- Success rate: > 95%

---

**Importante:** Non dimenticare di fare il redeploy su Vercel dopo aver aggiunto `CRON_SECRET`!
