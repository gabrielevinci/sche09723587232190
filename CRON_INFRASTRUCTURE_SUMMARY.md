# 📋 RIEPILOGO: Infrastruttura Cron Job

## ✅ COSA È STATO FATTO

### 1. Endpoint API Creato
**File:** `src/app/api/cron/trigger/route.ts`

**Funzionalità:**
- ✅ Riceve chiamate POST da cron-job.org ogni 50 minuti
- ✅ Autenticazione con secret (Bearer token)
- ✅ Logging dettagliato di ogni esecuzione
- ✅ Struttura pronta per aggiungere azioni
- ✅ Supporto GET per test in development

**URL Endpoint:**
- Locale: `http://localhost:3000/api/cron/trigger`
- Produzione: `https://tuosito.vercel.app/api/cron/trigger`

### 2. Secret Generato
```
CRON_SECRET=9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395
```

**Dove usarlo:**
- ✅ `.env.local` (per test locale)
- ⏳ Vercel Environment Variables (DA FARE - vedi guida)
- ⏳ cron-job.org header Authorization (DA FARE - vedi guida)

### 3. Guida Completa
**File:** `CRON_JOB_SETUP.md`

Contiene istruzioni dettagliate per:
- Configurare il secret su Vercel
- Creare account su cron-job.org
- Configurare il cron job (ogni 50 minuti)
- Testare il funzionamento
- Monitorare i log
- Troubleshooting

### 4. Script di Test
**File:** `scripts/test-cron-job.ps1`

Per testare l'endpoint localmente:
```powershell
.\scripts\test-cron-job.ps1
```

---

## 🎯 PROSSIMI PASSI

### STEP 1: Configurazione Base (DA FARE SUBITO)

1. **Aggiungi CRON_SECRET su Vercel:**
   - Vai su Vercel → Settings → Environment Variables
   - Aggiungi: `CRON_SECRET=9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395`
   - Redeploy il progetto

2. **Crea account su cron-job.org:**
   - Registrati su: https://console.cron-job.org/signup
   - Verifica email

3. **Configura il Cron Job:**
   - URL: `https://tuosito.vercel.app/api/cron/trigger`
   - Method: POST
   - Header: `Authorization: Bearer 9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395`
   - Schedule: Every 50 minutes

4. **Test:**
   - Clicca "Execute now" su cron-job.org
   - Controlla i log su Vercel
   - Dovrebbe mostrare: `🔔 CRON JOB TRIGGERED!`

### STEP 2: Implementare Azioni (DOPO CHE IL CRON FUNZIONA)

Una volta che vedi i log funzionare ogni 50 minuti, aggiungeremo le azioni:

#### Azione 1: Controllo Post Schedulati ⏰
```typescript
// Query database per post nelle prossime 2 ore
const upcomingPosts = await prisma.scheduledPost.findMany({
  where: {
    scheduledFor: {
      lte: new Date(Date.now() + 2 * 60 * 60 * 1000), // +2 ore
      gte: new Date() // Da ora in poi
    },
    status: 'pending'
  }
})
```

#### Azione 2: Upload Video su Spaces 📤
```typescript
// Per ogni post:
// 1. Controllare se video già caricato
// 2. Se no, caricare su DigitalOcean Spaces
// 3. Aggiornare URL nel database
```

#### Azione 3: Upload Video su OnlySocial 🚀
```typescript
// 2 ore prima della pubblicazione:
// 1. Chiamare OnlySocial API per upload video
// 2. Salvare media_uuid ricevuto
// 3. Aggiornare database con media_uuid
```

#### Azione 4: Pubblicazione Contenuti 📢
```typescript
// All'orario di pubblicazione:
// 1. Chiamare OnlySocial API per pubblicare
// 2. Aggiornare status a 'published'
// 3. Salvare post_id ritornato
```

#### Azione 5: Pulizia e Manutenzione 🧹
```typescript
// Dopo pubblicazione:
// 1. Rimuovere file temporanei
// 2. Archiviare post pubblicati
// 3. Inviare notifiche/report
```

---

## 📊 COME MONITORARE

### Vercel Logs
1. Vai su: https://vercel.com/dashboard
2. Seleziona il progetto
3. Clicca "Logs"
4. Cerca: `CRON JOB TRIGGERED`

**Esempio log corretto:**
```
🔔 ========================================
🔔 CRON JOB TRIGGERED!
🔔 Timestamp: 2025-12-01T14:00:00.000Z
🔔 ========================================
✅ Cron job autenticato correttamente
📋 Inizio esecuzione azioni programmate...
📝 Azione 1: Verifica sistema
✅ Esecuzione cron job completata
```

### cron-job.org History
1. Vai su: https://console.cron-job.org/jobs
2. Clicca sul job
3. Tab "History"
4. Status 200 = OK ✅

---

## 🔧 TROUBLESHOOTING COMUNI

### ❌ "Unauthorized" (401)
**Causa:** Secret non configurato o errato
**Soluzione:** 
- Verifica CRON_SECRET su Vercel
- Redeploy dopo aver aggiunto la variabile
- Controlla header Authorization su cron-job.org

### ❌ "Server configuration error" (500)
**Causa:** CRON_SECRET non trovato
**Soluzione:**
- Aggiungi la variabile su Vercel
- Fai redeploy

### ❌ Timeout
**Causa:** Azioni troppo lente
**Soluzione:**
- Aumenta timeout su cron-job.org (max 60s)
- Ottimizza le query database
- Usa processi asincroni

### ❌ Cron non si attiva
**Causa:** Job disabilitato o URL errato
**Soluzione:**
- Verifica che il job sia "Enabled"
- Controlla l'URL (deve essere quello di Vercel)
- Testa manualmente con "Execute now"

---

## 📝 CHECKLIST RAPIDA

Prima di dire "È pronto":

- [ ] CRON_SECRET aggiunto su Vercel
- [ ] Redeploy fatto su Vercel
- [ ] Account creato su cron-job.org
- [ ] Cron job configurato (POST, header, schedule)
- [ ] Test manuale fatto ("Execute now")
- [ ] Log visibili su Vercel con `CRON JOB TRIGGERED`
- [ ] Response 200 OK su cron-job.org
- [ ] Job attivo e schedulato ogni 50 minuti

Quando tutti i punti sono ✅, dimmi e procediamo con le azioni! 🚀

---

## 🎉 QUANDO TUTTO FUNZIONA

Una volta che vedi nei log:
```
🔔 CRON JOB TRIGGERED!
```

Ogni 50 minuti per almeno 2-3 cicli consecutivi, allora possiamo dire:

✅ **INFRASTRUTTURA CRON JOB PRONTA!**

A quel punto inizieremo ad aggiungere le azioni una per volta, testando dopo ogni aggiunta.

---

## 📞 PROSSIMA COMUNICAZIONE

Fammi sapere quando hai:
1. ✅ Configurato tutto su cron-job.org
2. ✅ Visto almeno 2 esecuzioni consecutive con successo
3. ✅ Confermato che i log appaiono su Vercel

Poi passeremo all'implementazione delle azioni! 🎯
