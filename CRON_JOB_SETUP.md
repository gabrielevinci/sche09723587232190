# 🔔 GUIDA: Configurazione Cron Job con cron-job.org

## 📝 PANORAMICA

Useremo cron-job.org per chiamare il nostro endpoint `/api/cron/trigger` ogni 50 minuti.
Questo attiverà automaticamente tutte le azioni programmate sul nostro sito.

---

## 🔐 STEP 1: Configurare il Secret

### 1.1 Aggiungere CRON_SECRET alle variabili d'ambiente

**Vercel (Produzione):**
1. Vai su: https://vercel.com/gabrielevinci/[nome-progetto]/settings/environment-variables
2. Aggiungi una nuova variabile:
   - **Name:** `CRON_SECRET`
   - **Value:** `9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395`
   - **Environment:** Production, Preview, Development (seleziona tutti)
3. Clicca "Save"
4. **IMPORTANTE:** Dopo aver salvato, vai su "Deployments" e fai "Redeploy" per applicare la nuova variabile

**Locale (.env.local):**
```env
CRON_SECRET=9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395
```

---

## 🌐 STEP 2: Ottenere l'URL del tuo sito

Dopo il deploy su Vercel, avrai un URL tipo:
```
https://tuosito.vercel.app
```

L'endpoint del cron sarà:
```
https://tuosito.vercel.app/api/cron/trigger
```

---

## ⚙️ STEP 3: Configurare cron-job.org

### 3.1 Creare un account
1. Vai su: https://console.cron-job.org/signup
2. Registrati (è gratuito)
3. Verifica la tua email

### 3.2 Creare il Cron Job

1. **Login:** https://console.cron-job.org/login

2. **Clicca su "Create cronjob"**

3. **Configurazione del Job:**

   **Title:**
   ```
   OnlySocial Scheduler - Every 50 minutes
   ```

   **Address (URL):**
   ```
   https://tuosito.vercel.app/api/cron/trigger
   ```
   ⚠️ Sostituisci `tuosito.vercel.app` con il tuo dominio Vercel

   **Schedule:**
   - Seleziona: **"Every X minutes"**
   - Imposta: **50** minuti
   - Oppure usa espressione cron personalizzata: `*/50 * * * *`

   **Request method:**
   - Seleziona: **POST**

   **Request headers:**
   Clicca su "Add header" e aggiungi:
   
   **Header Name:** `Authorization`
   **Header Value:** `Bearer 9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395`

   **Request body:**
   - Content-Type: `application/json`
   - Body (opzionale):
   ```json
   {
     "source": "cron-job.org",
     "trigger": "scheduled"
   }
   ```

   **Notifications:**
   - ✅ Enable "Notify on failure"
   - Email: [tua-email]

   **Timeout:**
   - Imposta: **60 secondi**

4. **Salva il Job:**
   - Clicca "Create cronjob"
   - Il job sarà attivo immediatamente

---

## 🧪 STEP 4: Testare il Cron Job

### 4.1 Test Manuale dal Browser (solo in development)

```
http://localhost:3000/api/cron/trigger
```

### 4.2 Test con curl

```bash
curl -X POST https://tuosito.vercel.app/api/cron/trigger \
  -H "Authorization: Bearer 9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395" \
  -H "Content-Type: application/json"
```

### 4.3 Test da cron-job.org

1. Vai su: https://console.cron-job.org/jobs
2. Trova il tuo job nella lista
3. Clicca sui tre puntini (⋮)
4. Clicca "Execute now"
5. Controlla i log per vedere se è andato a buon fine

---

## 📊 STEP 5: Monitorare i Log

### 5.1 Su Vercel
1. Vai su: https://vercel.com/gabrielevinci/[nome-progetto]
2. Clicca su "Logs" nel menu
3. Cerca: `CRON JOB TRIGGERED`
4. Dovresti vedere i log ogni 50 minuti

### 5.2 Su cron-job.org
1. Vai su: https://console.cron-job.org/jobs
2. Clicca sul tuo job
3. Vai su "History"
4. Vedrai lo storico di tutte le esecuzioni con:
   - Status code (200 = successo)
   - Response time
   - Response body

---

## ✅ STEP 6: Verifica che Funzioni

Quando il cron job funziona correttamente, dovresti vedere:

**Nei log di Vercel:**
```
🔔 ========================================
🔔 CRON JOB TRIGGERED!
🔔 Timestamp: 2025-12-01T14:00:00.000Z
🔔 ========================================
✅ Cron job autenticato correttamente
📋 Inizio esecuzione azioni programmate...
📝 Azione 1: Verifica sistema
📝 Azione 2: Controllo post schedulati (TODO)
📝 Azione 3: Upload video (TODO)
✅ Esecuzione cron job completata
```

**Nei log di cron-job.org:**
```json
{
  "success": true,
  "message": "Cron job executed successfully",
  "timestamp": "2025-12-01T14:00:00.000Z",
  "actions": [...]
}
```

---

## 🎯 PROSSIMI PASSI

Una volta che il cron job funziona, aggiungeremo progressivamente le azioni:

### Fase 1: ✅ Endpoint base (FATTO)
- Autenticazione con secret
- Logging base
- Struttura per azioni future

### Fase 2: 📋 Controllo Post Schedulati (DA FARE)
- Query database per post nelle prossime 2 ore
- Identificare quali video uploadare

### Fase 3: 📤 Upload Video (DA FARE)
- Upload su DigitalOcean Spaces
- Upload su OnlySocial API (2 ore prima della pubblicazione)

### Fase 4: 📢 Pubblicazione Automatica (DA FARE)
- Pubblicare contenuti all'orario programmato
- Aggiornare stato nel database

### Fase 5: 🧹 Pulizia e Manutenzione (DA FARE)
- Rimuovere file temporanei
- Archiviare post pubblicati
- Invio notifiche/report

---

## 🔧 TROUBLESHOOTING

### Problema: "Unauthorized" (401)
- Verifica che il CRON_SECRET sia corretto in Vercel
- Verifica che l'header Authorization sia impostato correttamente
- Fai redeploy su Vercel dopo aver aggiunto la variabile

### Problema: Timeout
- Aumenta il timeout su cron-job.org (max 60 secondi)
- Ottimizza le azioni per essere più veloci

### Problema: Cron job non si attiva
- Verifica che il job sia "Enabled" su cron-job.org
- Controlla la storia delle esecuzioni per errori
- Verifica l'URL del sito

---

## 📞 CONTATTI

Se hai problemi:
1. Controlla i log su Vercel
2. Controlla la history su cron-job.org
3. Testa l'endpoint manualmente con curl
4. Verifica che tutte le variabili d'ambiente siano configurate

---

## 🎉 QUANDO È PRONTO

Fammi sapere quando:
1. Hai configurato il CRON_SECRET su Vercel
2. Hai creato il job su cron-job.org
3. Hai fatto un test e vedi i log

Poi procederemo ad aggiungere le azioni reali una per volta! 🚀
