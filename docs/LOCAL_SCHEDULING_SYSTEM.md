# 🎯 Sistema di Scheduling Locale - OnlySocial

## 📝 Problema Risolto

OnlySocial API **non supporta lo scheduling programmato** (tutte le date future vengono rifiutate con errore "date is in the past"). L'unico modo funzionante è la **pubblicazione immediata** con `postNow: true`.

## ✅ Soluzione Implementata

Sistema di scheduling locale usando:
- **Database Neon** per salvare post programmati
- **Cron Jobs Vercel** che controllano periodicamente i post da pubblicare
- **Pubblicazione immediata** quando arriva l'ora impostata

---

## 🏗️ Architettura

### Flusso Completo

```
1. UTENTE → Carica video e imposta data/ora pubblicazione
   ↓
2. FRONTEND → Salva nel database (videoUrls + metadata + scheduledFor)
   ↓  
3. API /api/posts/schedule → Salva ScheduledPost (status: PENDING)
   ↓
4. CRON PRE-UPLOAD (ogni ora) → Post da pubblicare nelle prossime 2 ore
   ↓
5. Upload video su OnlySocial + Crea post (NON pubblica)
   ↓
6. Database → status: MEDIA_UPLOADED
   ↓
7. CRON PUBLISH (ogni 5 minuti) → Post da pubblicare ORA (±5 minuti)
   ↓
8. OnlySocial API → publishPostNow (postNow: true)
   ↓
9. Database → status: PUBLISHED
```

---

## 📊 Schema Database

### Tabella: `scheduled_posts`

```typescript
model ScheduledPost {
  id                 String     @id @default(cuid())
  userId             String
  socialAccountId    String
  accountUuid        String     @default("")  // UUID account OnlySocial
  accountId          Int?       // ID intero OnlySocial (dopo conversione)
  
  // Video (array multipli)
  videoUrls          String[]   @default([])  // URL DigitalOcean Spaces
  videoFilenames     String[]   @default([])  // Nomi originali
  videoSizes         Int[]      @default([])  // Dimensioni in bytes
  
  // OnlySocial IDs
  onlySocialMediaIds String[]   @default([])  // Media IDs dopo upload
  onlySocialPostUuid String?    // Post UUID dopo creazione
  
  // Contenuto
  caption            String
  postType           String     @default("reel")
  
  // Scheduling
  scheduledFor       DateTime   // SEMPRE IN UTC!
  timezone           String     @default("Europe/Rome")
  
  // Stati
  status             PostStatus @default(PENDING)
  preUploaded        Boolean    @default(false)
  preUploadAt        DateTime?
  publishedAt        DateTime?
  
  // Error handling
  errorMessage       String?
  retryCount         Int        @default(0)
  maxRetries         Int        @default(3)
  
  // Audit
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
}

enum PostStatus {
  PENDING           // In attesa
  MEDIA_UPLOADED    // Video caricati, in attesa di pubblicazione
  PUBLISHED         // Pubblicato con successo
  FAILED            // Errore durante pubblicazione
  CANCELLED         // Cancellato dall'utente
}
```

---

## 🔄 API Endpoints

### POST `/api/posts/schedule`

Salva un post programmato nel database.

**Request Body:**
```json
{
  "socialAccountId": "clxxx123",
  "accountUuid": "5877d32c-9284-4a65-bfff-65b666097009",
  "caption": "Il mio video programmato!",
  "postType": "reel",
  "videoUrls": [
    "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/video1.mp4"
  ],
  "videoFilenames": ["video1.mp4"],
  "videoSizes": [15728640],
  "scheduledFor": "2025-10-31T15:00:00.000Z",
  "timezone": "Europe/Rome"
}
```

**Response:**
```json
{
  "success": true,
  "postId": "cm3abcd123",
  "scheduledFor": "2025-10-31T15:00:00.000Z",
  "message": "Post scheduled successfully. Videos will be uploaded 2 hours before publication."
}
```

---

### GET `/api/cron/pre-upload`

Cron job che **pre-carica video** 2 ore prima della pubblicazione.

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Flusso:**
1. Query DB: `status = PENDING AND preUploaded = false AND scheduledFor <= NOW + 2 hours`
2. Per ogni post:
   - Converti Account UUID → Integer ID
   - Upload video su OnlySocial (scarica da DO + FormData)
   - Crea post su OnlySocial (NON pubblica)
   - Update DB: `status = MEDIA_UPLOADED`, salva media IDs e post UUID

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "successCount": 2,
  "failedCount": 1,
  "results": [
    {
      "postId": "cm3abcd123",
      "status": "success",
      "mediaIds": ["12345"],
      "postUuid": "abc-123-def"
    }
  ]
}
```

---

### GET `/api/cron/publish`

Cron job che **pubblica post** all'ora programmata.

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Flusso:**
1. Query DB: `status = MEDIA_UPLOADED AND scheduledFor BETWEEN NOW - 5min AND NOW + 5min`
2. Per ogni post:
   - OnlySocial API: `publishPostNow(postUuid)` con `postNow: true`
   - Update DB: `status = PUBLISHED`, `publishedAt = NOW`

**Response:**
```json
{
  "success": true,
  "processed": 2,
  "publishedCount": 2,
  "failedCount": 0,
  "results": [
    {
      "postId": "cm3abcd123",
      "status": "published",
      "publishedAt": "2025-10-31T15:00:32.123Z"
    }
  ]
}
```

---

## ⚙️ Configurazione

### 1. Variabili d'Ambiente (`.env.local`)

```bash
# Database Neon
DATABASE_URL="postgresql://neondb_owner:password@ep-xxx.neon.tech/neondb?sslmode=require"

# OnlySocial API
ONLYSOCIAL_API_KEY=D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60
ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d

# DigitalOcean Spaces
DO_SPACES_ENDPOINT=https://lon1.digitaloceanspaces.com
DO_SPACES_BUCKET=scheduler-0chiacchiere
DO_SPACES_ACCESS_KEY_ID=DO00WECDB3PZ8T4KQNCV
DO_SPACES_SECRET_ACCESS_KEY=kP6wBcl1epRJtsmaxB+PKAUZfqYXadJp30YVRBE7jog

# Cron Job Security
CRON_SECRET=b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2
```

### 2. Vercel Cron Jobs (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/pre-upload",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/publish",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedulazione:**
- **Pre-upload**: Ogni ora alle :00 (es: 14:00, 15:00, 16:00)
- **Publish**: Ogni 5 minuti (es: 14:00, 14:05, 14:10, 14:15, ...)

### 3. Applicare Schema al Database

```bash
# Sync schema con database
npx prisma db push

# Genera Prisma Client
npx prisma generate
```

---

## 🧪 Test Sistema

### 1. Test Endpoint Schedule

```bash
curl -X POST http://localhost:3000/api/posts/schedule \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "socialAccountId": "clxxx123",
    "accountUuid": "5877d32c-9284-4a65-bfff-65b666097009",
    "caption": "Test post",
    "postType": "reel",
    "videoUrls": ["https://your-space.com/video.mp4"],
    "videoFilenames": ["video.mp4"],
    "videoSizes": [10485760],
    "scheduledFor": "2025-10-31T15:00:00.000Z",
    "timezone": "Europe/Rome"
  }'
```

### 2. Test Cron Pre-Upload (Locale)

```bash
curl http://localhost:3000/api/cron/pre-upload \
  -H "Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2"
```

### 3. Test Cron Publish (Locale)

```bash
curl http://localhost:3000/api/cron/publish \
  -H "Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2"
```

### 4. Verifica Database

```sql
-- Post in attesa
SELECT COUNT(*) FROM scheduled_posts WHERE status = 'PENDING';

-- Post con video caricati
SELECT COUNT(*) FROM scheduled_posts WHERE status = 'MEDIA_UPLOADED';

-- Post pubblicati
SELECT COUNT(*) FROM scheduled_posts WHERE status = 'PUBLISHED';

-- Post falliti
SELECT * FROM scheduled_posts 
WHERE status = 'FAILED' 
ORDER BY updated_at DESC;
```

---

## 📁 Struttura File Implementati

```
src/
├── lib/
│   ├── db/
│   │   └── neon.ts                        # Database utilities
│   └── onlysocial-api.ts                  # API client (getAccountIntegerId)
├── app/
    └── api/
        ├── posts/
        │   └── schedule/
        │       └── route.ts               # POST /api/posts/schedule
        └── cron/
            ├── pre-upload/
            │   └── route.ts               # GET /api/cron/pre-upload
            └── publish/
                └── route.ts               # GET /api/cron/publish

prisma/
└── schema.prisma                          # Schema aggiornato

vercel.json                                # Configurazione cron
```

---

## ⚠️ Punti Critici

1. **NON usare mai scheduling OnlySocial** - Non funziona! Usa solo `postNow: true`
2. **Pre-upload 2 ore prima** - Tempo per gestire errori prima della pubblicazione
3. **Finestra pubblicazione ±5 minuti** - Per non perdere post se cron ritarda
4. **Gestione errori con retry** - Max 3 tentativi con `retryCount`
5. **Timezone handling** - Salva sempre in UTC nel database
6. **Protezione cron endpoint** - Usa `CRON_SECRET` per sicurezza

---

## 🎯 Vantaggi di Questa Soluzione

✅ **Affidabile**: Non dipende da OnlySocial scheduling (che non funziona)  
✅ **Flessibile**: Supporta array di video multipli  
✅ **Ottimizzato**: Pre-upload 2 ore prima risparmia tempo  
✅ **Robusto**: Gestione errori con retry automatici  
✅ **Scalabile**: Supporta più utenti e timezone diversi  
✅ **Monitorabile**: Stati chiari (PENDING → MEDIA_UPLOADED → PUBLISHED)

---

## 📊 Monitoraggio

### Dashboard Query Utili

```sql
-- Statistiche giornaliere
SELECT 
  DATE(scheduled_for) as date,
  status,
  COUNT(*) as count
FROM scheduled_posts
GROUP BY DATE(scheduled_for), status
ORDER BY date DESC;

-- Post programmati prossime 24 ore
SELECT 
  id,
  caption,
  scheduled_for,
  status,
  pre_uploaded
FROM scheduled_posts
WHERE scheduled_for >= NOW()
  AND scheduled_for <= NOW() + INTERVAL '24 hours'
ORDER BY scheduled_for ASC;

-- Performance ultimi 7 giorni
SELECT 
  status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM scheduled_posts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status;
```

---

## 🚀 Deploy su Vercel

1. **Commit e Push**:
   ```bash
   git add .
   git commit -m "feat: implementato sistema scheduling locale con database Neon e cron jobs"
   git push origin main
   ```

2. **Vercel Auto-Deploy**: Deployment automatico su push a `main`

3. **Verifica Cron Jobs**: Dashboard Vercel → Project Settings → Cron Jobs
   - ✅ Pre-upload: ogni ora
   - ✅ Publish: ogni 5 minuti

4. **Monitora Logs**: Vercel Dashboard → Functions → Logs
   - Cerca: "Starting pre-upload cron job"
   - Cerca: "Starting publish cron job"

---

## 📝 Note Finali

Questo sistema **bypassa completamente** lo scheduling di OnlySocial. Tutto viene gestito dal database Neon e i post vengono pubblicati al momento giusto usando `postNow: true` (unico metodo funzionante).

**Importante**: OnlySocial ha un limite di 20GB di storage totale. Il pre-upload 2 ore prima aiuta a ottimizzare l'uso dello spazio, caricando solo quando necessario.
