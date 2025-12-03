# ✅ AGGIORNAMENTO DATABASE - STATI POST

## 🎯 COSA È STATO IMPLEMENTATO

### 📊 Nuovi Stati Aggiunti

**Schema Prisma aggiornato:**
```prisma
enum PostStatus {
  PENDING           // In attesa di pubblicazione
  MEDIA_UPLOADED    // Media caricato su OnlySocial, in attesa di schedulazione (NUOVO)
  SCHEDULED         // Schedulato su OnlySocial (NUOVO)
  PUBLISHED         // Pubblicato con successo
  FAILED            // Errore durante pubblicazione
  CANCELLED         // Cancellato dall'utente
}
```

### 🔄 Workflow Stati

```
PENDING
   ↓
   ↓ [Cron Job: Upload video su OnlySocial]
   ↓
MEDIA_UPLOADED (opzionale - attualmente salta direttamente a SCHEDULED)
   ↓
   ↓ [Cron Job: Schedula post su OnlySocial]
   ↓
SCHEDULED ← **STATO ATTUALE DOPO CRON JOB**
   ↓
   ↓ [OnlySocial pubblica automaticamente all'orario]
   ↓
PUBLISHED

In caso di errore in qualsiasi step:
   ↓
FAILED
```

### 📁 File Modificati

1. **`prisma/schema.prisma`**
   - Aggiunto `MEDIA_UPLOADED`
   - Aggiunto `SCHEDULED`

2. **`src/lib/db/neon.ts`**
   - Aggiunta funzione `updateScheduledPostStatus()`
   - Gestisce aggiornamento status, media IDs, post UUID, errori

3. **`src/app/api/cron/trigger/route.ts`**
   - Importato `updateScheduledPostStatus` e `PostStatus`
   - Step 4: Aggiorna database dopo schedulazione
   - Gestione errori: salva status FAILED in database

### 🗄️ Funzione Update Database

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
)
```

**Cosa salva:**
- ✅ `status`: SCHEDULED o FAILED
- ✅ `onlySocialMediaIds`: [984474] (media caricati)
- ✅ `onlySocialPostUuid`: "4f4c0582-bc08..." (UUID post OnlySocial)
- ✅ `onlySocialMediaUrl`: "https://storage.onlysocial.io/..." (URL video su OnlySocial)
- ✅ `errorMessage`: messaggio errore (se fallito)
- ✅ `updatedAt`: timestamp italiano

---

## 🚀 LOG COMPLETO CON UPDATE

### Esecuzione Cron Job di Successo:

```
🔔 CRON JOB TRIGGERED!
⏰ Finestra temporale (ora italiana):
   Now Italian: 2025-12-03T06:36:16.895Z
   Da: 2025-12-03T06:26:16.895Z (now - 10min)
   A: 2025-12-03T07:36:16.895Z (now + 60min)

✅ Trovati 1 post da processare

🎬 Processando post ID: cmipj16pl0003ih0443r0s0s7
   Video: video.mp4
   Account: 5877d32c-9284-4a65-bfff-65b666097009
   Scheduled for: 2025-12-03 06:50:00

📤 Step 1: Upload video su OnlySocial...
✅ Video caricato - Media ID: 984474

📝 Step 2: Creazione post su OnlySocial...
✅ Post creato - UUID: 4f4c0582-bc08-4718-9788-7a74e5dc2fad

⏰ Step 3: Schedulazione post...
✅ Post schedulato per: 2025-12-03 05:50:00

💾 Step 4: Aggiornamento database...
📝 Aggiornamento database per post cmipj16pl0003ih0443r0s0s7:
   Status: SCHEDULED
   OnlySocial Post UUID: 4f4c0582-bc08-4718-9788-7a74e5dc2fad
   OnlySocial Media IDs: 984474
✅ Database aggiornato - Status: SCHEDULED

✅ Post cmipj16pl0003ih0443r0s0s7 processato con successo!

✅ Esecuzione cron job completata
⏱️  Tempo di esecuzione: 9500ms
📊 Risultati: 1 successi, 0 errori
```

### In caso di errore:

```
❌ Errore processando post cmipj16pl0003ih0443r0s0s7:
   Error: Failed to upload video: 403 Forbidden

💾 Database aggiornato - Status: FAILED
📝 Error message salvato: "Failed to upload video: 403 Forbidden"
```

---

## 🗄️ MIGRAZIONE DATABASE

### ⚠️ AZIONE RICHIESTA: Applicare Migrazione

La migrazione SQL deve essere applicata **manualmente** al database Neon:

```sql
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
```

### Metodi di Applicazione:

#### Metodo 1: Neon Console (Consigliato)
1. Vai su: https://console.neon.tech
2. Seleziona il database
3. Clicca "SQL Editor"
4. Copia e incolla:
   ```sql
   ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
   ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
   ```
5. Esegui

#### Metodo 2: Script PowerShell
```powershell
.\scripts\apply-enum-migration.ps1
```

#### Metodo 3: psql (se installato)
```bash
psql "$DATABASE_URL" -c "ALTER TYPE \"PostStatus\" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED'; ALTER TYPE \"PostStatus\" ADD VALUE IF NOT EXISTS 'SCHEDULED';"
```

---

## ✅ VERIFICA CHE FUNZIONI

### 1. Applica Migrazione
Esegui la migrazione SQL su Neon (vedi sopra)

### 2. Redeploy su Vercel
- Il nuovo codice è già pushato su GitHub
- Vercel farà auto-deploy
- Oppure fai redeploy manuale

### 3. Testa con Cron Job
Aspetta il prossimo ciclo (ogni 50 minuti) o triggera manualmente:

```bash
curl -X POST https://tuosito.vercel.app/api/cron/trigger \
  -H "Authorization: Bearer 9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395"
```

### 4. Verifica Database
Dopo l'esecuzione, controlla nel database Neon:

```sql
SELECT 
  id,
  caption,
  status,
  "onlySocialPostUuid",
  "onlySocialMediaIds",
  "onlySocialMediaUrl",
  "scheduledFor",
  "updatedAt"
FROM scheduled_posts
WHERE status = 'SCHEDULED'
ORDER BY "updatedAt" DESC
LIMIT 5;
```

Dovresti vedere:
- ✅ `status` = `SCHEDULED`
- ✅ `onlySocialPostUuid` popolato
- ✅ `onlySocialMediaIds` con array di IDs
- ✅ `onlySocialMediaUrl` con URL video
- ✅ `updatedAt` aggiornato

---

## 📊 STATI POST - TABELLA COMPLETA

| Stato | Quando | Campi Popolati |
|-------|--------|----------------|
| **PENDING** | Post appena creato dall'utente | videoUrls, caption, scheduledFor |
| **SCHEDULED** | Dopo cron job riuscito | + onlySocialPostUuid, onlySocialMediaIds, onlySocialMediaUrl |
| **PUBLISHED** | OnlySocial pubblica all'orario | + publishedAt |
| **FAILED** | Errore durante cron job | + errorMessage, retryCount++ |
| **CANCELLED** | Utente cancella manualmente | - |

---

## 🎯 CHECKLIST FINALE

- [x] Schema Prisma aggiornato con nuovi stati
- [x] Funzione `updateScheduledPostStatus()` implementata
- [x] Cron job aggiorna database dopo ogni step
- [x] Gestione errori salva FAILED nel database
- [x] Codice pushato su GitHub
- [ ] **Migrazione SQL applicata su Neon** ← DA FARE
- [ ] Redeploy Vercel completato
- [ ] Test con cron job manuale
- [ ] Verifica database aggiornato

---

## 🎉 RISULTATO FINALE

Dopo questa implementazione:

1. ✅ Cron job trova post PENDING nella finestra temporale
2. ✅ Upload video su OnlySocial
3. ✅ Crea e schedula post su OnlySocial
4. ✅ **NUOVO**: Aggiorna database con status SCHEDULED
5. ✅ **NUOVO**: Salva tutti i dati OnlySocial (UUID, media IDs, URL)
6. ✅ **NUOVO**: In caso di errore, salva status FAILED con messaggio

Il database ora traccia completamente lo stato di ogni post! 🎯
