# 🗄️ Database Schema Update - OnlySocial Integration

## 📋 Panoramica

Questo documento descrive le modifiche allo schema del database per supportare la tracciabilità completa del processo di upload e schedulazione su OnlySocial.

## ❌ Problema Riscontrato

```
Error [PrismaClientValidationError]: 
Unknown argument `onlySocialMediaIds`. Available options are marked with ?.
```

**Causa**: Lo schema del database non conteneva i campi necessari per memorizzare i dati restituiti dall'API OnlySocial dopo l'upload del video e la creazione del post.

## ✅ Soluzione Implementata

### 1. Schema Prisma (`prisma/schema.prisma`)

#### A. Nuovi stati enum `PostStatus`:
```prisma
enum PostStatus {
  PENDING           // Post creato, in attesa di processamento
  MEDIA_UPLOADED    // Video caricato su OnlySocial storage
  SCHEDULED         // Post schedulato su OnlySocial
  PUBLISHED         // Post pubblicato con successo
  FAILED           // Errore durante il processo
  CANCELLED        // Post cancellato dall'utente
}
```

#### B. Nuovi campi integrazione OnlySocial:
```prisma
model ScheduledPost {
  // ... campi esistenti ...
  
  // OnlySocial Integration Data (salvati dopo upload e schedulazione)
  onlySocialPostUuid String?    // UUID del post creato su OnlySocial
  onlySocialMediaIds Int[]      @default([])  // Array di ID media caricati
  onlySocialMediaUrl String?    // URL primo video su OnlySocial storage
  
  // ... altri campi ...
}
```

### 2. Migrazioni SQL

#### Migrazione 1: `add_media_uploaded_scheduled_status.sql`
```sql
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
```

#### Migrazione 2: `add_onlysocial_integration_fields.sql`
```sql
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" INTEGER[] DEFAULT '{}';

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaUrl" TEXT;
```

### 3. Funzione Update Database (`src/lib/db/neon.ts`)

```typescript
export async function updateScheduledPostStatus(
  postId: string,
  data: {
    status: PostStatus;
    onlySocialPostUuid?: string;
    onlySocialMediaIds?: number[];
    onlySocialMediaUrl?: string;
    errorMessage?: string;
  }
) {
  const nowItalian = new Date(Date.now() + 60 * 60 * 1000);
  
  return await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: data.status,
      onlySocialPostUuid: data.onlySocialPostUuid,
      onlySocialMediaIds: data.onlySocialMediaIds,
      onlySocialMediaUrl: data.onlySocialMediaUrl,
      errorMessage: data.errorMessage,
      updatedAt: nowItalian,
    },
  });
}
```

### 4. Integrazione nel Cron Job (`src/app/api/cron/trigger/route.ts`)

```typescript
// Step 4: Aggiorna database con successo
await updateScheduledPostStatus(post.id, {
  status: PostStatus.SCHEDULED,
  onlySocialPostUuid: scheduledPost.uuid,
  onlySocialMediaIds: [uploadResult.id],
  onlySocialMediaUrl: uploadResult.url,
});
```

## 🚀 Come Applicare le Migrazioni

### Opzione 1: Neon Console (Consigliato)

1. Vai su: https://console.neon.tech
2. Seleziona il tuo database
3. Vai su **SQL Editor**
4. Copia e incolla tutto questo SQL:

```sql
-- ====================================
-- MIGRAZIONI DATABASE - OnlySocial Integration
-- ====================================

-- Migrazione 1: Nuovi stati enum
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Migrazione 2: Campi integrazione OnlySocial
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" INTEGER[] DEFAULT '{}';

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaUrl" TEXT;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN "scheduled_posts"."onlySocialPostUuid" IS 'UUID del post creato su OnlySocial API (Step 2)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaIds" IS 'Array di ID media caricati su OnlySocial storage (Step 1)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaUrl" IS 'URL del primo video caricato su OnlySocial storage (Step 1)';
```

5. Esegui la query
6. Verifica che tutto sia andato a buon fine

### Opzione 2: Script PowerShell

```powershell
# Dalla root del progetto
.\scripts\apply-all-migrations.ps1
```

Lo script mostrerà l'SQL da copiare e le istruzioni dettagliate.

### Opzione 3: psql CLI

```bash
# Richiede psql installato
psql "$DATABASE_URL" << EOF
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" INTEGER[] DEFAULT '{}';

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaUrl" TEXT;
EOF
```

## 🧪 Verifica Post-Migrazione

### 1. Verifica Schema Tabella

```sql
\d scheduled_posts
```

Dovresti vedere:
```
onlySocialPostUuid  | text                |           |          |
onlySocialMediaIds  | integer[]           |           |          | '{}'
onlySocialMediaUrl  | text                |           |          |
```

### 2. Verifica Enum

```sql
SELECT unnest(enum_range(NULL::PostStatus));
```

Output atteso:
```
PENDING
MEDIA_UPLOADED
SCHEDULED
PUBLISHED
FAILED
CANCELLED
```

### 3. Test Query Update

```sql
UPDATE scheduled_posts 
SET 
  status = 'SCHEDULED',
  onlySocialPostUuid = 'test-uuid-123',
  onlySocialMediaIds = ARRAY[123456],
  onlySocialMediaUrl = 'https://storage.onlysocial.io/test.mp4'
WHERE id = 'your-test-post-id';
```

## 📊 Flusso Dati Completo

### Prima (❌ Errore)
```
1. Cron Job processa post
2. Upload video → Media ID: 984501
3. Crea post → UUID: 1d6069a1-...
4. Schedula post → ✅ Success
5. Aggiorna DB → ❌ ERROR: Unknown argument `onlySocialMediaIds`
```

### Dopo (✅ Funzionante)
```
1. Cron Job processa post
2. Upload video → Media ID: 984501
3. Crea post → UUID: 1d6069a1-...
4. Schedula post → ✅ Success
5. Aggiorna DB → ✅ SUCCESS
   - status: SCHEDULED
   - onlySocialPostUuid: 1d6069a1-...
   - onlySocialMediaIds: [984501]
   - onlySocialMediaUrl: https://storage.onlysocial.io/...mp4
```

## 🎯 Benefici

1. **Tracciabilità Completa**: Ogni post ha tutti i riferimenti OnlySocial
2. **Debug Facilitato**: Possiamo verificare quale Media ID o Post UUID è stato creato
3. **Retry Logic**: In caso di fallimento, sappiamo dove riprendere il processo
4. **Audit Trail**: Storico completo di cosa è stato caricato e quando
5. **Sincronizzazione**: Possiamo verificare lo stato su OnlySocial usando UUID salvato

## 📝 Note Tecniche

- **Tipo Array**: `INTEGER[]` supporta array di numeri per media multipli (future-proof)
- **Nullable**: Campi `TEXT?` permettono NULL per post non ancora processati
- **Default**: `onlySocialMediaIds` ha default `'{}'` (array vuoto)
- **Commenti SQL**: Aggiunti per documentazione in-database
- **IF NOT EXISTS**: Migrazioni idempotenti, possono essere ri-eseguite senza errori

## ✅ Checklist Post-Migrazione

- [ ] Migrazioni SQL applicate su Neon
- [ ] Schema verificato con `\d scheduled_posts`
- [ ] Enum verificato con query `unnest()`
- [ ] Prisma Client rigenerato (`npx prisma generate`)
- [ ] Codice deployato su Vercel
- [ ] Test manuale cron job
- [ ] Verificato aggiornamento database dopo schedulazione
- [ ] Controllato che `status = 'SCHEDULED'` e campi OnlySocial popolati

## 🔗 File Correlati

- `prisma/schema.prisma` - Schema database aggiornato
- `prisma/migrations/add_media_uploaded_scheduled_status.sql` - Migrazione enum
- `prisma/migrations/add_onlysocial_integration_fields.sql` - Migrazione campi
- `scripts/apply-all-migrations.ps1` - Script applicazione migrazioni
- `src/lib/db/neon.ts` - Funzione `updateScheduledPostStatus()`
- `src/app/api/cron/trigger/route.ts` - Integrazione cron job

---

**Data Creazione**: 2025-12-03  
**Ultima Modifica**: 2025-12-03  
**Autore**: GitHub Copilot  
**Status**: ✅ Pronto per produzione
