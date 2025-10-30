# Nuovo Sistema di Scheduling (2025-10-30)

## Panoramica

Il sistema è stato completamente ridisegnato per implementare un flusso in 3 fasi:

1. **Salvataggio immediato nel database** (niente su OnlySocial)
2. **Pre-caricamento video 1 ora prima** (solo upload media)
3. **Pubblicazione immediata all'ora esatta** (creazione post + pubblicazione)

## Flusso Dettagliato

### Fase 1: Scheduling Utente (`/api/schedule/smart-schedule`)

**Cosa succede:**
- L'utente carica i video e imposta l'ora di pubblicazione
- TUTTI i video vengono salvati nel database Neon con `status: PENDING`
- Video caricati su DigitalOcean Spaces
- **NIENTE viene caricato su OnlySocial**

**Dati salvati nel database:**
```typescript
{
  status: 'PENDING',
  preUploaded: false,
  videoUrls: [...], // URL DigitalOcean
  videoFilenames: [...],
  videoSizes: [...],
  scheduledFor: '2025-10-30T14:00:00.000Z', // UTC
  accountUuid: 'uuid-account-onlysocial',
  caption: 'Testo del post',
  postType: 'reel' | 'story' | 'post'
}
```

### Fase 2: Pre-Caricamento (`/api/cron/pre-upload`)

**Quando viene eseguito:**
- Ogni ora (cron job)
- Cerca post da pubblicare nelle **prossime 1 ora**

**Cosa fa:**
1. Trova post con `status: PENDING` e `preUploaded: false`
2. Filtra quelli da pubblicare entro 1 ora
3. Per ogni post:
   - Scarica il video da DigitalOcean
   - **Carica il video su OnlySocial** (ottiene `mediaId`)
   - Salva i `mediaIds` nel database
   - Aggiorna `status: MEDIA_UPLOADED` e `preUploaded: true`
   - **NON crea il post su OnlySocial**

**Esempio di query:**
```sql
SELECT * FROM scheduled_posts 
WHERE status = 'PENDING' 
  AND preUploaded = false 
  AND scheduledFor <= NOW() + INTERVAL '1 hour'
  AND scheduledFor > NOW()
```

**Aggiornamento database:**
```typescript
{
  status: 'MEDIA_UPLOADED',
  preUploaded: true,
  preUploadAt: '2025-10-30T13:05:00.000Z',
  onlySocialMediaIds: ['123456'], // IDs dei media caricati
  accountId: 789 // ID intero dell'account
}
```

### Fase 3: Pubblicazione Immediata (`/api/cron/publish`)

**Quando viene eseguito:**
- Ogni 5 minuti (cron job)
- Cerca post da pubblicare **ORA** (finestra ±5 minuti)

**Cosa fa:**
1. Trova post con `status: MEDIA_UPLOADED`
2. Filtra quelli da pubblicare adesso (±5 minuti)
3. Per ogni post:
   - **Crea il post su OnlySocial** con i `mediaIds` già caricati
   - **Pubblica immediatamente** con `postNow: true`
   - Aggiorna `status: PUBLISHED` e `publishedAt`

**Esempio di query:**
```sql
SELECT * FROM scheduled_posts 
WHERE status = 'MEDIA_UPLOADED'
  AND scheduledFor >= NOW() - INTERVAL '5 minutes'
  AND scheduledFor <= NOW() + INTERVAL '5 minutes'
```

**Aggiornamento database:**
```typescript
{
  status: 'PUBLISHED',
  publishedAt: '2025-10-30T14:00:30.000Z'
}
```

## Stati del Post

| Stato | Descrizione |
|-------|-------------|
| `PENDING` | Video salvato nel DB, non ancora caricato su OnlySocial |
| `MEDIA_UPLOADED` | Video caricato su OnlySocial, in attesa di pubblicazione |
| `PUBLISHED` | Post creato e pubblicato con successo |
| `FAILED` | Errore durante caricamento o pubblicazione |
| `CANCELLED` | Cancellato dall'utente |

## Timeline Esempio

Supponiamo che l'utente voglia pubblicare un video alle **14:00 UTC**:

| Ora | Azione | Sistema |
|-----|--------|---------|
| **12:30** | Utente carica video | `smart-schedule` salva nel DB (`PENDING`) |
| **13:00** | Cron pre-upload | Trova il post (1h prima) → carica video → `MEDIA_UPLOADED` |
| **13:30** | Cron pre-upload | Niente da fare |
| **14:00** | Cron publish | Crea post + pubblica immediatamente → `PUBLISHED` |

## Vantaggi del Nuovo Sistema

### ✅ Pubblicazione Precisa
- Post pubblicati IMMEDIATAMENTE all'ora programmata
- Nessun ritardo dovuto all'elaborazione di OnlySocial

### ✅ Upload Anticipato
- Video caricati 1 ora prima per evitare problemi di rete
- Post pronti per la pubblicazione istantanea

### ✅ Affidabilità
- Tutto salvato nel database Neon
- Tracking completo di ogni fase
- Gestione errori separata per upload e pubblicazione

### ✅ Performance
- Upload separato dalla pubblicazione
- Nessun carico al momento della pubblicazione

## Configurazione Cron Jobs

### Pre-Upload (ogni ora)
```bash
0 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://tuodominio.com/api/cron/pre-upload
```

### Publish (ogni 5 minuti)
```bash
*/5 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://tuodominio.com/api/cron/publish
```

## API Calls OnlySocial

### Fase 2 (Pre-Upload)
```typescript
// Upload video
POST /os/api/{workspace}/media
Content-Type: multipart/form-data
Body: FormData con file binario

Response: { id: 123456, url: "...", ... }
```

### Fase 3 (Publish)
```typescript
// 1. Crea post
POST /os/api/{workspace}/posts
Body: {
  accounts: [789],
  versions: [{
    account_id: 789,
    content: ["Caption"],
    media_ids: ["123456"],
    is_original: true
  }],
  post_type: "reel"
}

Response: { uuid: "post-uuid-xxx" }

// 2. Pubblica immediatamente
POST /os/api/{workspace}/posts/schedule/{post-uuid}
Body: { postNow: true }
```

## Testing

### Test Manuale
```bash
# 1. Schedula un video per tra 2 ore
# Vai su http://localhost:3000/dashboard e carica un video

# 2. Simula pre-upload (modifica il tempo a 3 ore)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/pre-upload

# 3. Verifica database
# SELECT * FROM scheduled_posts WHERE status = 'MEDIA_UPLOADED'

# 4. Simula publish
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/publish

# 5. Verifica database
# SELECT * FROM scheduled_posts WHERE status = 'PUBLISHED'
```

## Monitoraggio

### Log da Controllare

**Smart Schedule:**
```
📅 Saving 3 videos to database for user user@example.com
💾 Saving video to database: video1.mp4
   Scheduled for (UTC): 2025-10-30T14:00:00.000Z
   Will be uploaded at (UTC): 2025-10-30T13:00:00.000Z
   ✅ Saved to database with ID: ckxxx
```

**Pre-Upload:**
```
🔄 Starting pre-upload cron job...
📋 Found 2 posts to pre-upload
📤 Processing post ID: ckxxx
   📹 Uploading video 1/1...
      ✅ Uploaded! Media ID: 123456
   ✅ Database updated - Status: MEDIA_UPLOADED
   ⏰ Post will be published at: 2025-10-30T14:00:00.000Z
```

**Publish:**
```
🚀 Starting publish cron job...
📋 Found 1 posts to publish NOW
🚀 Publishing post ID: ckxxx
   Media IDs: 123456
   📝 Creating post on OnlySocial...
   ✅ Post created with UUID: post-uuid-xxx
   🚀 Publishing NOW...
   ✅ Published successfully!
   ✅ Database updated - Status: PUBLISHED
```

## Troubleshooting

### Post non viene pre-caricato
- Verifica che `scheduledFor` sia tra 1 ora
- Controlla che `status = PENDING` e `preUploaded = false`
- Verifica i log del cron job pre-upload

### Post non viene pubblicato
- Verifica che `status = MEDIA_UPLOADED`
- Controlla che `onlySocialMediaIds` non sia vuoto
- Verifica che `scheduledFor` sia nell'intervallo ±5 minuti

### Errore di upload video
- Controlla che i video siano accessibili su DigitalOcean
- Verifica le credenziali OnlySocial (`ONLYSOCIAL_API_KEY`)
- Controlla la dimensione del video (max 100MB)

## File Modificati

1. ✅ `/src/app/api/schedule/smart-schedule/route.ts`
   - Rimosso upload su OnlySocial
   - Salva tutto nel DB con `PENDING`

2. ✅ `/src/app/api/cron/pre-upload/route.ts`
   - Cambiato da 2 ore a 1 ora
   - Rimossa creazione post su OnlySocial
   - Solo upload video + salva mediaIds

3. ✅ `/src/app/api/cron/publish/route.ts`
   - Aggiunta creazione post su OnlySocial
   - Pubblicazione immediata con mediaIds pre-caricati

## Database Schema (No Changes)

Lo schema del database rimane invariato. Gli stati e i campi esistenti sono sufficienti:

```prisma
model ScheduledPost {
  status              PostStatus  // PENDING → MEDIA_UPLOADED → PUBLISHED
  preUploaded         Boolean     // false → true dopo pre-upload
  onlySocialMediaIds  String[]    // Popolato durante pre-upload
  scheduledFor        DateTime    // Quando pubblicare (UTC)
  // ... altri campi
}
```

## Conclusione

Il nuovo sistema garantisce:
- 📅 **Precisione**: Pubblicazione esattamente all'ora programmata
- ⚡ **Velocità**: Upload anticipato per pubblicazione istantanea
- 🔒 **Affidabilità**: Tutto trackato nel database con stati chiari
- 🎯 **Semplicità**: Flusso lineare in 3 fasi ben separate
