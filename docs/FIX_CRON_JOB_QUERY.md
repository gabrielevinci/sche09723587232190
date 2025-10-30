# Fix: Cron Job Non Trova Post PENDING

## Problema

Il cron job `/api/cron/pre-upload` NON trovava i post in stato `PENDING` anche se erano presenti nel database.

### Causa

La funzione `getPostsDueForPreUpload()` aveva una condizione che **escludeva i post nel passato**:

```typescript
scheduledFor: {
  lte: futureDate,
  gt: new Date(),  // ❌ PROBLEMA: Esclude post schedulati prima di ORA
}
```

Questo significava che:
- Post schedulati per "ORA" venivano esclusi
- Post schedulati nel passato (anche di pochi minuti) venivano esclusi
- Solo post nel futuro venivano trovati

### Esempio

Se un post era schedulato per le **03:10** e il cron girava alle **03:18** (8 minuti dopo), veniva **ignorato** perché `03:10 < 03:18` (nel passato).

## Soluzione

### 1. Modificato `getPostsDueForPreUpload()` in `/src/lib/db/neon.ts`

**PRIMA:**
```typescript
scheduledFor: {
  lte: futureDate,
  gt: new Date(),  // ❌ Esclude post nel passato
}
```

**ADESSO:**
```typescript
scheduledFor: {
  lte: futureDate,
  // ✅ RIMOSSO gt: new Date() per includere post nel passato
}
```

Ora la query trova **TUTTI** i post in `PENDING` che:
- Sono schedulati fino a X ore nel futuro
- **INCLUDENDO** post nel passato che devono ancora essere caricati

### 2. Modificato `getPostsDueForPublishing()` in `/src/lib/db/neon.ts`

**PRIMA:**
```typescript
const past = new Date(now.getTime() - minutesWindow * 60000)  // ±5 minuti
```

**ADESSO:**
```typescript
const past = new Date(now.getTime() - 30 * 60000)  // -30 minuti nel passato
```

Questo permette di recuperare post che dovevano essere pubblicati fino a 30 minuti fa, in caso di:
- Cron job saltato
- Server temporaneamente offline
- Errori temporanei

## Test di Verifica

### Prima delle Modifiche

```bash
$ npm run test:check-pending

📋 Found 3 PENDING posts
✅ Query returned 0 posts  # ❌ PROBLEMA!
```

### Dopo le Modifiche

```bash
$ npm run test:check-pending

📋 Found 3 PENDING posts
✅ Query returned 3 posts  # ✅ RISOLTO!

📌 Post ID: cmhcu9t8k0001l104us06ry5o
   Scheduled for: 2025-10-30T03:10:00.000Z
   Time diff: -9 minutes (PAST!)
   ✅ The cron job WILL find these posts!
```

## Query SQL Finale

La query ora generata da Prisma è:

```sql
SELECT * FROM scheduled_posts 
WHERE status = 'PENDING'
  AND preUploaded = false
  AND scheduledFor <= (NOW() + INTERVAL '1 hour')
-- ✅ RIMOSSO: AND scheduledFor > NOW()
ORDER BY scheduledFor ASC
```

## Comportamento Post-Fix

### Pre-Upload Cron Job

Ora trova post:
- ✅ Schedulati entro 1 ora nel futuro
- ✅ Schedulati per ORA
- ✅ Schedulati nel passato (post "in ritardo")
- ✅ Con `status = PENDING` e `preUploaded = false`

### Publish Cron Job

Ora trova post:
- ✅ Schedulati entro 5 minuti nel futuro
- ✅ Schedulati per ORA
- ✅ Schedulati fino a 30 minuti nel passato
- ✅ Con `status = MEDIA_UPLOADED`

## Script di Test Aggiunti

### 1. `scripts/check-pending-posts.ts`
Mostra tutti i post PENDING nel database con analisi dettagliata:
```bash
.\scripts\run-with-env.ps1 scripts/check-pending-posts.ts
```

### 2. `scripts/test-pre-upload.ts`
Testa direttamente la query `getPostsDueForPreUpload()`:
```bash
.\scripts\run-with-env.ps1 scripts/test-pre-upload.ts
```

### 3. `scripts/run-with-env.ps1`
Helper per eseguire script con variabili d'ambiente da `.env.local`:
```bash
.\scripts\run-with-env.ps1 <path-to-script>
```

## File Modificati

1. ✅ `/src/lib/db/neon.ts`
   - `getPostsDueForPreUpload()`: Rimossa condizione `gt: new Date()`
   - `getPostsDueForPublishing()`: Estesa finestra passato a 30 minuti

2. ✅ `/scripts/check-pending-posts.ts` (nuovo)
3. ✅ `/scripts/test-pre-upload.ts` (nuovo)
4. ✅ `/scripts/run-with-env.ps1` (nuovo)

## Risultato

🎉 **Il cron job ora trova correttamente tutti i post PENDING**, inclusi quelli:
- Nel passato (post "saltati")
- Schedulati per l'ora attuale
- Nel futuro (entro la finestra temporale)

## Prossimi Passi

1. **Eseguire il cron job manualmente** per processare i 3 post PENDING:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/pre-upload
   ```

2. **Verificare che i post vengano caricati** su OnlySocial
3. **Verificare che cambino stato** a `MEDIA_UPLOADED`
4. **Eseguire il cron job di pubblicazione**:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/publish
   ```

## Monitoraggio

I log del cron job ora mostreranno:
```
🔄 Starting pre-upload cron job...
📋 Found 3 posts to pre-upload
📤 Processing post ID: cmhcu9t8k0001l104us06ry5o
   📹 Uploading video 1/1...
   ✅ Uploaded! Media ID: 123456
   ✅ Database updated - Status: MEDIA_UPLOADED
```
