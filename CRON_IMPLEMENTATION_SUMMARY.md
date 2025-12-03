# 🚀 IMPLEMENTAZIONE CRON JOB - UPLOAD E SCHEDULAZIONE

## ✅ COSA È STATO IMPLEMENTATO

### 📁 File Creati/Modificati

#### 1. `src/lib/onlysocial.ts` (NUOVO)
**Funzionalità implementate:**

- **`uploadVideoToOnlySocial()`** - Step 1
  - Scarica video da Digital Ocean Spaces
  - Upload su OnlySocial via FormData
  - Restituisce media ID e URL

- **`createOnlySocialPost()`** - Step 2
  - Crea post con tutti i parametri richiesti
  - Converte scheduledFor in formato API (date + time)
  - Converte media ID a integer (IMPORTANTE!)
  - Gestisce tutte le opzioni per le varie piattaforme

- **`scheduleOnlySocialPost()`** - Step 3
  - Schedula il post con `postNow: false`
  - Rispetta data/ora programmata
  - Restituisce conferma schedulazione

#### 2. `src/lib/db/neon.ts` (MODIFICATO)
**Nuova funzione aggiunta:**

- **`getScheduledPostsForUpload()`**
  - Query database per post con status PENDING
  - Finestra temporale: `now - 10min` → `now + 60min`
  - Recupera anche post con errori del ciclo precedente (-10min)
  - Ordina per scheduledFor (più urgenti prima)

#### 3. `src/app/api/cron/trigger/route.ts` (MODIFICATO)
**Workflow completo implementato:**

1. **Autenticazione** con CRON_SECRET
2. **Calcolo finestra temporale**:
   - Start: `now - 10 minuti` (recupero errori)
   - End: `now + 60 minuti` (prossimi da pubblicare)
3. **Recupero post** da database
4. **Processamento** di ogni post:
   - Upload video
   - Creazione post
   - Schedulazione
5. **Logging dettagliato** di ogni step
6. **Gestione errori** per singolo post
7. **Report finale** con statistiche

---

## 🔄 WORKFLOW DETTAGLIATO

### Quando il Cron Job Scatta (ogni 50 minuti):

```
1. AUTENTICAZIONE
   ↓
2. CALCOLA FINESTRA TEMPORALE
   - now = 14:00
   - startWindow = 13:50 (now - 10min)
   - endWindow = 15:00 (now + 60min)
   ↓
3. QUERY DATABASE
   SELECT * FROM scheduled_post
   WHERE status = 'PENDING'
   AND scheduledFor >= '13:50'
   AND scheduledFor <= '15:00'
   ↓
4. PER OGNI POST TROVATO:
   │
   ├─> A. UPLOAD VIDEO
   │   • Scarica da Digital Ocean: post.videoUrls[0]
   │   • Upload a OnlySocial: POST /media
   │   • Riceve: mediaId, mediaUrl
   │
   ├─> B. CREA POST
   │   • Prepara payload completo
   │   • Converte mediaId a INTEGER
   │   • Formatta data/ora: "2025-12-03", "14:30"
   │   • POST /posts
   │   • Riceve: postUuid
   │
   ├─> C. SCHEDULA POST
   │   • POST /posts/schedule/{postUuid}
   │   • Body: { postNow: false }
   │   • Riceve: scheduled_at
   │
   └─> D. AGGIORNA DATABASE (TODO)
       • status: 'scheduled'
       • onlySocialMediaIds: [mediaId]
       • onlySocialPostUuid: postUuid
       • onlySocialMediaUrl: mediaUrl
   ↓
5. REPORT FINALE
   • Successi: X
   • Errori: Y
   • Tempo esecuzione: Zms
```

---

## 📊 ESEMPIO DI ESECUZIONE

### Input (Post nel Database):
```json
{
  "id": "post-123",
  "status": "PENDING",
  "scheduledFor": "2025-12-03 14:30:00",
  "videoUrls": ["https://spaces.com/video.mp4"],
  "videoFilenames": ["mio-reel.mp4"],
  "accountId": 58307,
  "accountUuid": "5877d32c-9284-4a65-bfff-65b666097009",
  "caption": "Guarda questo reel!",
  "postType": "reel"
}
```

### Log Output (Cron Job):
```
🔔 ========================================
🔔 CRON JOB TRIGGERED!
🔔 Timestamp: 2025-12-03T13:00:00.000Z
🔔 ========================================
✅ Cron job autenticato correttamente
📋 Inizio esecuzione azioni programmate...

⏰ Finestra temporale:
   Da: 2025-12-03T12:50:00.000Z
   A: 2025-12-03T14:00:00.000Z

📝 Azione: Recupero post schedulati da processare...
🔍 Query database per post schedulati...
   Status: PENDING
   ScheduledFor >= 2025-12-03T12:50:00.000Z
   ScheduledFor <= 2025-12-03T14:00:00.000Z
✅ Trovati 1 post da processare

🎬 Processando post ID: post-123
   Video: mio-reel.mp4
   Account: 5877d32c-9284-4a65-bfff-65b666097009
   Scheduled for: 2025-12-03T13:30:00.000Z

📤 Step 1: Upload video su OnlySocial...
📤 Downloading video from: https://spaces.com/video.mp4
✅ Video downloaded: 5.23 MB
📤 Uploading to OnlySocial...
✅ Video uploaded to OnlySocial - ID: 123456, URL: https://app.onlysocial.io/storage/.../video.mp4
✅ Video caricato - Media ID: 123456

📝 Step 2: Creazione post su OnlySocial...
📝 Creating post for account 58307
   Date: 2025-12-03, Time: 14:30
   Media ID: 123456 (type: number)
   Post Type: reel
✅ Post created - UUID: 6059e1b3-e102-4be5-951b-82698abd9ee3
✅ Post creato - UUID: 6059e1b3-e102-4be5-951b-82698abd9ee3

⏰ Step 3: Schedulazione post...
⏰ Scheduling post: 6059e1b3-e102-4be5-951b-82698abd9ee3
✅ Post scheduled for: 2025-12-03 14:30:00
✅ Post schedulato per: 2025-12-03 14:30:00

✅ Post post-123 processato con successo!

✅ Esecuzione cron job completata
⏱️  Tempo di esecuzione: 3241ms
📊 Risultati: 1 successi, 0 errori
🔔 ========================================
```

### Response API:
```json
{
  "success": true,
  "message": "Cron job executed successfully",
  "timestamp": "2025-12-03T13:00:00.000Z",
  "executionTime": "3241ms",
  "summary": {
    "postsFound": 1,
    "postsSuccess": 1,
    "postsFailed": 0
  },
  "actions": [
    {
      "name": "fetch_scheduled_posts",
      "status": "completed",
      "message": "Trovati 1 post",
      "details": { "count": 1 }
    },
    {
      "name": "process_posts",
      "status": "completed",
      "message": "Success: 1, Failed: 0",
      "details": {
        "success": 1,
        "failed": 0,
        "skipped": 0,
        "details": [
          { "postId": "post-123", "status": "success" }
        ]
      }
    }
  ],
  "details": [
    { "postId": "post-123", "status": "success" }
  ]
}
```

---

## ⚠️ DA COMPLETARE

### 1. Aggiornamento Database Dopo Successo
Attualmente commentato nel codice, da implementare in `neon.ts`:

```typescript
export async function updateScheduledPostStatus(
  postId: string,
  data: {
    status: PostStatus
    onlySocialMediaIds?: number[]
    onlySocialPostUuid?: string
    onlySocialMediaUrl?: string
    errorMessage?: string | null
  }
) {
  const now = new Date()
  const italianTime = new Date(now.getTime() + (60 * 60 * 1000))

  return await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      ...data,
      updatedAt: italianTime
    }
  })
}
```

Poi decommentare nel `route.ts`:
```typescript
// Step 4: Aggiorna database
await updateScheduledPostStatus(post.id, {
  status: 'scheduled',
  onlySocialMediaIds: [parseInt(uploadResult.id)],
  onlySocialPostUuid: createResult.uuid,
  onlySocialMediaUrl: uploadResult.url
})
```

### 2. Gestione Errori nel Database
Decommentare anche la parte di gestione errori:
```typescript
await updateScheduledPostStatus(post.id, {
  status: 'error',
  errorMessage: error.message
})
```

---

## 🧪 COME TESTARE

### 1. Prepara Post di Test
```sql
-- Inserisci un post da schedulare tra 30 minuti
INSERT INTO scheduled_post (
  user_id, 
  social_account_id,
  account_uuid,
  account_id,
  caption,
  post_type,
  video_urls,
  video_filenames,
  video_sizes,
  scheduled_for,
  status
) VALUES (
  'user-id',
  'social-account-id',
  '5877d32c-9284-4a65-bfff-65b666097009',
  58307,
  'Test reel automatico',
  'reel',
  ARRAY['https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/videos/test.mp4'],
  ARRAY['test.mp4'],
  ARRAY[5242880],
  NOW() + INTERVAL '30 minutes',
  'PENDING'
);
```

### 2. Trigger Manuale Cron Job
```bash
curl -X POST https://tuosito.vercel.app/api/cron/trigger \
  -H "Authorization: Bearer 9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395" \
  -H "Content-Type: application/json"
```

### 3. Controlla Logs su Vercel
- Vai su Vercel → Logs
- Cerca: `CRON JOB TRIGGERED`
- Verifica tutti gli step

### 4. Verifica su OnlySocial
- Login: https://app.onlysocial.io
- Vai su "Calendar" o "Posts"
- Dovresti vedere il post schedulato

---

## 📈 PROSSIMI MIGLIORAMENTI

1. **Retry Logic**: Implementare tentativi automatici per errori temporanei
2. **Rate Limiting**: Gestire limiti API OnlySocial
3. **Batch Processing**: Processare più video in parallelo
4. **Notifiche**: Email/webhook quando un post viene schedulato o fallisce
5. **Dashboard**: Interfaccia per monitorare lo stato del cron job
6. **Cleanup**: Rimuovere video da Spaces dopo upload su OnlySocial

---

## 🎯 CHECKLIST PRE-PRODUZIONE

- [ ] Testato con 1 post
- [ ] Testato con multipli post (5+)
- [ ] Testato recupero errori (post a now - 10min)
- [ ] Implementata funzione updateScheduledPostStatus
- [ ] Verificato che date/ore siano corrette (no conversione timezone)
- [ ] Testato con tutti i postType: reel, post, story
- [ ] Verificato media ID come integer
- [ ] Monitoraggio logs attivo
- [ ] Gestione errori completa
- [ ] Cron job attivo su cron-job.org

---

## 📞 SUPPORTO

Se incontri errori, controlla:

1. **Logs Vercel**: Quale step fallisce?
2. **Database**: Il post ha i campi corretti (accountId, videoUrls, etc.)?
3. **OnlySocial API**: Le credenziali sono valide?
4. **Video URL**: Il video su Spaces è accessibile?

Tipici errori:
- `media_id must be integer`: Media ID non convertito
- `Unauthorized`: Token OnlySocial non valido
- `Failed to download video`: URL Spaces errato o permessi mancanti
- `Invalid date format`: scheduledFor non in formato corretto
