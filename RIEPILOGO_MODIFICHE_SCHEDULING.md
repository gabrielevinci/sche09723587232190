# RIEPILOGO MODIFICHE - Sistema di Scheduling (30 Ottobre 2025)

## 🎯 Obiettivo

Modificare il sistema di scheduling per implementare un flusso in 3 fasi:
1. Salvare tutto nel database Neon (niente su OnlySocial)
2. Pre-caricare video 1 ora prima (solo upload media)
3. Pubblicare immediatamente all'ora esatta (creazione + pubblicazione)

## ✅ Modifiche Implementate

### 1. `/src/app/api/schedule/smart-schedule/route.ts`
**Cambiamento**: Salvataggio solo nel database, niente upload su OnlySocial

**PRIMA:**
- Caricava video su OnlySocial immediatamente se schedulati entro 1 ora
- Creava post schedulato su OnlySocial
- Gestiva logica complessa di upload immediato vs differito

**ADESSO:**
- Salva TUTTI i video nel database con `status: PENDING`
- Video rimangono su DigitalOcean Spaces
- Nessuna interazione con OnlySocial API
- Ritorna info su quando i video verranno caricati (1 ora prima)

### 2. `/src/app/api/cron/pre-upload/route.ts`
**Cambiamento**: Caricamento video senza creazione post

**PRIMA:**
- Caricava video su OnlySocial
- Creava post su OnlySocial (ma non lo pubblicava)
- Salvava post UUID nel database

**ADESSO:**
- Carica video su OnlySocial
- Salva solo i media IDs nel database
- **NON crea** il post su OnlySocial
- Aggiorna stato a `MEDIA_UPLOADED`

### 3. `/src/app/api/cron/publish/route.ts`
**Cambiamento**: Creazione post + pubblicazione immediata

**PRIMA:**
- Prendeva post UUID già esistente
- Pubblicava il post con `postNow: true`

**ADESSO:**
- Crea il post su OnlySocial usando i media IDs pre-caricati
- Pubblica immediatamente con `postNow: true`
- Tutto in un'unica operazione

### 4. `/src/lib/db/neon.ts` 🔧 **FIX CRITICO**
**Cambiamento**: Fix query che non trovava post PENDING

**PROBLEMA:**
```typescript
scheduledFor: {
  lte: futureDate,
  gt: new Date(),  // ❌ Escludeva post nel passato
}
```

**SOLUZIONE:**
```typescript
scheduledFor: {
  lte: futureDate,
  // ✅ Rimosso gt: new Date() - include anche post nel passato
}
```

**Modifiche Specifiche:**
- `getPostsDueForPreUpload()`: Rimossa condizione che escludeva post nel passato
- `getPostsDueForPublishing()`: Estesa finestra passato da 5 a 30 minuti

## 📊 Nuovo Flusso Operativo

```
┌─────────────────────────────────────────────────────────┐
│ 1. UTENTE SCHEDULA VIDEO (smart-schedule)              │
│                                                         │
│    Input: Video + Data/Ora pubblicazione               │
│    Output: Salvataggio nel DB con status PENDING       │
│    OnlySocial: NESSUNA interazione                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 2. CRON PRE-UPLOAD (ogni ora, 1h prima pubblicazione)  │
│                                                         │
│    Query: status=PENDING, scheduledFor≤now+1h          │
│    Azione:                                             │
│      - Scarica video da DigitalOcean                   │
│      - Carica su OnlySocial → ottiene mediaIds        │
│      - Salva mediaIds nel DB                           │
│      - NON crea post                                   │
│    Output: status MEDIA_UPLOADED                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 3. CRON PUBLISH (ogni 5 min, all'ora esatta)          │
│                                                         │
│    Query: status=MEDIA_UPLOADED, scheduledFor±5min     │
│    Azione:                                             │
│      - Crea post con mediaIds                          │
│      - Pubblica IMMEDIATAMENTE (postNow: true)         │
│      - Aggiorna DB                                     │
│    Output: status PUBLISHED                            │
└─────────────────────────────────────────────────────────┘
```

## 🐛 Bug Fix: Query Non Trovava Post

### Problema Identificato
Il cron job `/api/cron/pre-upload` non trovava i 3 post PENDING presenti nel database.

### Causa
La query aveva `scheduledFor > NOW()` che escludeva:
- Post schedulati per ORA
- Post schedulati nel passato (anche di pochi minuti)

### Verifica Pre-Fix
```sql
-- Query generata da Prisma (PRIMA)
WHERE status = 'PENDING' 
  AND preUploaded = false
  AND scheduledFor <= NOW() + INTERVAL '1 hour'
  AND scheduledFor > NOW()  -- ❌ Questo escludeva i post!
```

Risultato: **0 post trovati** ❌

### Verifica Post-Fix
```sql
-- Query generata da Prisma (DOPO)
WHERE status = 'PENDING' 
  AND preUploaded = false
  AND scheduledFor <= NOW() + INTERVAL '1 hour'
  -- ✅ Rimosso scheduledFor > NOW()
```

Risultato: **3 post trovati** ✅

## 🧪 Script di Test Aggiunti

### 1. `scripts/check-pending-posts.ts`
Mostra tutti i post PENDING con analisi dettagliata:
- Conta post per stato
- Calcola differenza temporale
- Identifica quali dovrebbero essere processati
- Mostra post MEDIA_UPLOADED

```bash
.\scripts\run-with-env.ps1 scripts/check-pending-posts.ts
```

### 2. `scripts/test-pre-upload.ts`
Testa la query `getPostsDueForPreUpload()`:
- Simula il comportamento del cron job
- Mostra quali post verranno trovati
- Verifica URL dei video

```bash
.\scripts\run-with-env.ps1 scripts/test-pre-upload.ts
```

### 3. `scripts/run-with-env.ps1`
Helper PowerShell per caricare `.env.local`:
```powershell
.\scripts\run-with-env.ps1 <script-path>
```

## 📁 File Modificati

### Core System
1. ✅ `/src/app/api/schedule/smart-schedule/route.ts` - Solo salvataggio DB
2. ✅ `/src/app/api/cron/pre-upload/route.ts` - Solo upload media
3. ✅ `/src/app/api/cron/publish/route.ts` - Creazione + pubblicazione immediata
4. ✅ `/src/lib/db/neon.ts` - Fix query per trovare post PENDING

### Documentation
5. ✅ `/docs/NEW_SCHEDULING_SYSTEM.md` - Documentazione completa nuovo sistema
6. ✅ `/docs/FIX_CRON_JOB_QUERY.md` - Documentazione fix query

### Testing Scripts
7. ✅ `/scripts/check-pending-posts.ts` - Verifica post nel database
8. ✅ `/scripts/test-pre-upload.ts` - Test query pre-upload
9. ✅ `/scripts/run-with-env.ps1` - Helper per eseguire script

## 🎯 Stato Attuale

### Database
- **3 post in PENDING** pronti per essere processati
- Schedulati per: `2025-10-30T03:10:00.000Z` (9 minuti fa)
- Account: `5877d32c-9284-4a65-bfff-65b666097009`

### Sistema
- ✅ Query fix implementato
- ✅ Nuovo flusso implementato
- ✅ Script di test pronti
- ⏳ In attesa di eseguire cron jobs

## 🚀 Prossimi Passi

### 1. Testare Pre-Upload Manualmente
```bash
# Avvia il dev server se non è già attivo
npm run dev

# In un altro terminale
$env:CRON_SECRET="b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2"
curl.exe -H "Authorization: Bearer $env:CRON_SECRET" http://localhost:3000/api/cron/pre-upload
```

**Risultato atteso:**
- ✅ Trova 3 post
- ✅ Carica 3 video su OnlySocial
- ✅ Salva mediaIds nel database
- ✅ Aggiorna status a `MEDIA_UPLOADED`

### 2. Verificare Database
```bash
.\scripts\run-with-env.ps1 scripts/check-pending-posts.ts
```

**Risultato atteso:**
- 0 post PENDING
- 3 post MEDIA_UPLOADED

### 3. Testare Publish Manualmente
```bash
curl.exe -H "Authorization: Bearer $env:CRON_SECRET" http://localhost:3000/api/cron/publish
```

**Risultato atteso:**
- ✅ Trova 3 post con status MEDIA_UPLOADED
- ✅ Crea 3 post su OnlySocial
- ✅ Pubblica immediatamente
- ✅ Aggiorna status a `PUBLISHED`

### 4. Configurare Cron Jobs in Produzione

**Pre-Upload (ogni ora):**
```bash
0 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://tuodominio.com/api/cron/pre-upload
```

**Publish (ogni 5 minuti):**
```bash
*/5 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://tuodominio.com/api/cron/publish
```

## 📈 Vantaggi del Nuovo Sistema

### Precisione
- ⏱️ Pubblicazione esattamente all'ora programmata
- 🎯 Nessun ritardo dovuto a elaborazione OnlySocial

### Affidabilità
- 💾 Tutto tracciato nel database Neon
- 🔄 Post "in ritardo" vengono recuperati automaticamente
- 📊 Stati chiari per ogni fase

### Performance
- ⚡ Upload separato dalla pubblicazione
- 🚀 Pubblicazione istantanea (media già pronti)
- 📦 Nessun carico al momento della pubblicazione

### Manutenibilità
- 🧪 Script di test per debug
- 📝 Documentazione completa
- 🔍 Log dettagliati per monitoring

## ✅ Checklist Completamento

- [x] Modificato smart-schedule per salvare solo nel DB
- [x] Modificato pre-upload per caricare senza creare post
- [x] Modificato publish per creare + pubblicare immediatamente
- [x] Fixato query che non trovava post PENDING
- [x] Creati script di test
- [x] Documentazione completa
- [ ] Test manuale pre-upload
- [ ] Test manuale publish
- [ ] Deploy in produzione
- [ ] Configurazione cron jobs produzione

## 📞 Support

In caso di problemi:

1. Verificare post nel database:
   ```bash
   .\scripts\run-with-env.ps1 scripts/check-pending-posts.ts
   ```

2. Testare query pre-upload:
   ```bash
   .\scripts\run-with-env.ps1 scripts/test-pre-upload.ts
   ```

3. Controllare log cron job nel terminale dev server

4. Verificare variabili d'ambiente in `.env.local`
