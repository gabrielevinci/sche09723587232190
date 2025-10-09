# 🕒 Configurazione Cron Job per Smart Scheduling

## 📋 Panoramica

Il sistema di **Smart Scheduling** ottimizza l'uso dello spazio su OnlySocial (limitato a 20GB) caricando i video solo quando necessario:

- **Video immediati** (< 1 ora): Caricati su DigitalOcean + OnlySocial subito
- **Video futuri** (> 1 ora): Caricati solo su DigitalOcean, poi processati dal cron job 1 ora prima della pubblicazione

## 🏗️ Architettura

```
┌─────────────────┐
│   Utente clicca │
│ "Schedula Tutti"│
└────────┬────────┘
         │
         ▼
┌────────────────────────────┐
│  Smart Scheduling Logic    │
│  /api/schedule/smart-schedule│
└────────┬───────────┬───────┘
         │           │
    < 1 ora      > 1 ora
         │           │
         ▼           ▼
┌─────────────┐  ┌──────────────┐
│ Upload NOW  │  │ Save to DB   │
│ DO + OS     │  │ Status:      │
│ + Schedule  │  │ VIDEO_       │
│             │  │ UPLOADED_DO  │
└─────────────┘  └──────┬───────┘
                        │
                        │ Cron Job
                        │ Ogni 10 min
                        ▼
              ┌──────────────────┐
              │ Check DB for     │
              │ videos scheduled │
              │ within 1 hour    │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Upload to OS     │
              │ + Schedule Post  │
              │ Update Status    │
              └──────────────────┘
```

## 🔧 Setup Cron Job su cron-job.org

### Step 1: Crea Account
1. Vai su https://cron-job.org/en/
2. Registrati gratuitamente
3. Verifica la tua email

### Step 2: Genera CRON_SECRET

Genera una stringa random sicura per proteggere l'endpoint:

```bash
# Opzione 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opzione 2: Online
# Usa: https://generate-secret.vercel.app/32
```

Esempio output: `7a3f9c2e1d4b6a8f5e3c9d7b2a4f6e8c1d3b5a7f9e2c4d6a8b1f3e5c7d9a2b4f6`

### Step 3: Configura Environment Variables su Vercel

1. Vai su Vercel Dashboard
2. Seleziona il tuo progetto
3. Settings → Environment Variables
4. Aggiungi:

```env
CRON_SECRET=7a3f9c2e1d4b6a8f5e3c9d7b2a4f6e8c1d3b5a7f9e2c4d6a8b1f3e5c7d9a2b4f6
```

5. Salva e Redeploy

### Step 4: Configura Cron Job

1. **Login** su cron-job.org
2. **Crea nuovo cron job**:

   ```
   Title: OnlySocial Smart Scheduling
   
   URL: https://your-app.vercel.app/api/cron/process-pending-videos
   
   HTTP Method: POST
   
   Headers:
   Authorization: Bearer 7a3f9c2e1d4b6a8f5e3c9d7b2a4f6e8c1d3b5a7f9e2c4d6a8b1f3e5c7d9a2b4f6
   
   Schedule: */10 * * * *  (Ogni 10 minuti)
   
   Time Zone: Europe/Rome (o la tua timezone)
   
   Enable notifications: ✓
   Send email if job fails: your-email@example.com
   ```

3. **Salva** il cron job
4. **Testa** manualmente con "Run now"

## 📊 Stati del Post

### PostStatus Enum

| Stato | Descrizione |
|-------|-------------|
| `PENDING` | Post appena creato, non ancora processato |
| `VIDEO_UPLOADED_DO` | Video caricato su DigitalOcean, in attesa di upload su OS |
| `VIDEO_UPLOADED_OS` | Video caricato su OnlySocial |
| `SCHEDULED` | Post schedulato su OnlySocial |
| `PUBLISHED` | Post pubblicato con successo |
| `FAILED` | Errore durante il processo (dopo 3 tentativi) |
| `CANCELLED` | Cancellato manualmente dall'utente |

### Flusso Stati

```
PENDING
   │
   ▼
VIDEO_UPLOADED_DO ──────┐
   │                    │ (> 1 ora)
   │ (< 1 ora)          │
   ▼                    ▼
VIDEO_UPLOADED_OS   [Attende Cron]
   │                    │
   ▼                    ▼
SCHEDULED ◄──────────────┘
   │
   │ (OnlySocial pubblica)
   ▼
PUBLISHED
```

## 🔍 Monitoring

### Verifica Funzionamento

#### 1. Test Endpoint Manuale
```bash
curl -X POST https://your-app.vercel.app/api/cron/process-pending-videos \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### 2. Log Vercel
```
Vercel Dashboard → Your Project → Functions → Logs
```

Cerca:
```
🔄 Cron job started: Processing pending videos
📊 Found X videos to process
🚀 Processing video ...
✅ Video uploaded to OnlySocial, ID: ...
✅ Post scheduled on OnlySocial, UUID: ...
✅ Cron job completed
```

#### 3. Log cron-job.org
```
Dashboard → Your Cron Job → Execution History
```

Verifica:
- **Status**: 200 OK
- **Response time**: < 30s
- **Success rate**: > 95%

### Alert Configurati

**cron-job.org** ti invierà email se:
- Endpoint ritorna errore (status != 200)
- Timeout (> 30s)
- Job fallisce 3 volte consecutive

## 🐛 Troubleshooting

### Errore 401 Unauthorized

**Causa**: CRON_SECRET errato o non configurato

**Soluzione**:
1. Verifica che `CRON_SECRET` sia configurato su Vercel
2. Verifica che il header Authorization sia corretto
3. Redeploy su Vercel dopo aver modificato env vars

### Errore 500 Internal Server Error

**Causa**: Errore nel codice o database non raggiungibile

**Soluzione**:
1. Controlla i log su Vercel
2. Verifica che `DATABASE_URL` sia configurato
3. Verifica che OnlySocial credentials siano corrette

### Nessun Video Processato

**Causa**: Nessun video schedulato entro 1 ora

**Comportamento normale**: Il cron job ritorna success con `processed: 0`

### Video Non Caricato su OnlySocial

**Causa**: Errore durante l'upload

**Soluzione**:
1. Controlla campo `errorMessage` nel database
2. Il sistema riprova automaticamente fino a 3 volte
3. Dopo 3 tentativi, lo stato diventa `FAILED`

## 📈 Performance

### Frequenza Consigliata
- **10 minuti**: Bilanciamento tra reattività e costi
- **5 minuti**: Più reattivo, ma più chiamate API
- **15 minuti**: Meno chiamate, ma meno reattivo

### Costi
- cron-job.org: **GRATIS** fino a 3 cron jobs
- Vercel Functions: **Incluso** nel piano gratuito (100k invocazioni/mese)

Con 10 minuti di frequenza:
- 6 chiamate/ora × 24 ore × 30 giorni = **4,320 chiamate/mese**
- Ben sotto il limite di 100k ✅

## 🔐 Security

### Best Practices

1. **CRON_SECRET strong**:
   - Almeno 32 caratteri
   - Random, non un password comune
   - Cambia periodicamente (ogni 3-6 mesi)

2. **HTTPS Only**:
   - Vercel usa HTTPS di default ✅
   - cron-job.org usa HTTPS ✅

3. **Rate Limiting**:
   - Il cron job processa max 50 video per esecuzione
   - Evita overload del sistema

4. **Error Handling**:
   - Retry automatico (max 3 tentativi)
   - Notifiche email su fallimento
   - Log dettagliati per debugging

## 📚 API Endpoints

### POST /api/schedule/smart-schedule

**Descrizione**: Chiamato dall'interfaccia utente per schedulare video

**Body**:
```json
[
  {
    "socialAccountId": "cuid123",
    "videoUrl": "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/...",
    "videoFilename": "video.mp4",
    "videoSize": 2621440,
    "caption": "Beautiful video!",
    "postType": "reel",
    "scheduledFor": "2025-10-10T15:30:00.000Z"
  }
]
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "uploadedNow": 2,
    "savedForLater": 8,
    "errors": 0
  },
  "results": {
    "uploadedNow": [...],
    "savedForLater": [...],
    "errors": []
  }
}
```

### POST /api/cron/process-pending-videos

**Descrizione**: Chiamato dal cron job ogni 10 minuti

**Headers**:
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "processed": 5,
    "failed": 0
  },
  "errors": []
}
```

### GET /api/cron/process-pending-videos

**Descrizione**: Verifica che l'endpoint funzioni

**Response**:
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

## ✅ Checklist Setup

- [ ] Generato `CRON_SECRET`
- [ ] Configurato `CRON_SECRET` su Vercel
- [ ] Fatto deploy su Vercel
- [ ] Creato account su cron-job.org
- [ ] Configurato cron job con URL, headers, schedule
- [ ] Testato endpoint manualmente
- [ ] Verificato log su Vercel
- [ ] Verificato execution history su cron-job.org
- [ ] Configurato email notifications
- [ ] Testato con video reali

## 🎓 Esempio Completo

### Scenario: 10 Video da Schedulare

**Situazione**:
- Ora attuale: 10:00
- Video 1-2: Schedulati per 10:30 (tra 30 min) → < 1 ora
- Video 3-10: Schedulati per 15:00 (tra 5 ore) → > 1 ora

**Comportamento Sistema**:

1. **Utente clicca "Schedula Tutti" (10:00)**
   - Video 1-2: Upload su DO + OS + Schedule ✅
   - Video 3-10: Upload solo su DO, salva nel DB con status `VIDEO_UPLOADED_DO` 💾

2. **Cron Job Execution #1 (10:10)**
   - Cerca video con `scheduledFor <= 11:10` e status `VIDEO_UPLOADED_DO`
   - Nessuno trovato (Video 3-10 sono per le 15:00)
   - Response: `processed: 0` ✅

3. **Cron Job Execution #2 (14:00)**
   - Cerca video con `scheduledFor <= 15:00` e status `VIDEO_UPLOADED_DO`
   - Trova Video 3-10 ✅
   - Upload su OS + Schedule per tutti
   - Update status → `SCHEDULED` ✅

4. **Pubblicazione Automatica (15:00)**
   - OnlySocial pubblica Video 3-10
   - (Opzionale) Webhook aggiorna status → `PUBLISHED`

---

**Setup Completato!** 🎉

Il sistema ora gestisce automaticamente il caricamento intelligente dei video, ottimizzando lo spazio su OnlySocial.
