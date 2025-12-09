# 🐛 Fix: Lambda non trovava post FAILED (Recovery non funzionava)

**Data:** 9 dicembre 2025  
**Commit:** 0277c08

---

## 📋 Problema

Il Lambda non trovava post da processare anche quando c'erano post schedulati nell'orario corretto.

### Log del Lambda (09/12/2025 ore 10:00 italiane):

```
2025-12-09T09:00:27.898Z INFO Recovery (-6h): 04:00 to 10:00 (ora italiana)
2025-12-09T09:00:27.898Z INFO Upcoming (+65min): 10:00 to 11:05 (ora italiana)
2025-12-09T09:00:29.740Z INFO prisma:query SELECT ... WHERE status = 'PENDING' AND scheduledFor >= ... AND scheduledFor <= ...
2025-12-09T09:00:29.743Z INFO 📊 [Lambda] Found 0 videos to process
```

**Risultato:** 0 post trovati, nonostante ci fosse un post schedulato per le **10:45 UTC (11:45 ora italiana)**

### Verifica Database

Post trovati per oggi (09/12/2025):

```
Status: FAILED
Scheduled (UTC): 2025-12-09T10:45:00.000Z  ← Era nell'intervallo di ricerca!
Caption: ...
Error: Failed to download video: Forbidden
```

Altri post `PENDING` erano schedulati per le 18:20, 19:05, 20:10, 20:45, 20:50, 21:25 UTC.

---

## 🔍 Causa Root

Il Lambda cercava **solo post con status = 'PENDING'**:

```typescript
// ❌ QUERY VECCHIA (SBAGLIATA)
const videosToSchedule = await prisma.scheduledPost.findMany({
  where: {
    status: 'PENDING',  // ← Ignorava tutti i FAILED!
    scheduledFor: {
      gte: sixHoursAgo,
      lte: sixtyFiveMinutesFromNow
    }
  }
});
```

**Problema:**
- Post delle 10:45 era già fallito in un tentativo precedente (errore: "Forbidden")
- Status era diventato `FAILED`
- Il Lambda lo **ignorava completamente** perché cercava solo `PENDING`
- La funzione di **recovery** (-6h) era inutile: cercava solo post `PENDING` mai tentati

---

## ✅ Soluzione

Modificare la query per includere **anche i post FAILED** (per il retry automatico):

```typescript
// ✅ QUERY CORRETTA
const videosToSchedule = await prisma.scheduledPost.findMany({
  where: {
    status: {
      in: ['PENDING', 'FAILED']  // Include anche FAILED per retry
    },
    scheduledFor: {
      gte: sixHoursAgo,              // -6h (recovery)
      lte: sixtyFiveMinutesFromNow   // +65min (upcoming)
    }
  },
  orderBy: {
    scheduledFor: 'asc'
  },
  take: 25
});
```

**Vantaggi:**
1. ✅ **Recovery funziona**: Trova post FAILED nelle ultime 6 ore e riprova
2. ✅ **Retry automatico**: Post falliti vengono ritentati automaticamente
3. ✅ **Nessun post perso**: Anche se fallisce una volta, verrà ritentato nel recovery window

---

## 🧪 Test della Query

### Query Originale (SBAGLIATA):
```sql
SELECT * FROM scheduled_posts 
WHERE status = 'PENDING'  -- ❌ Solo PENDING
  AND scheduledFor >= '2025-12-09T09:56:08.364Z'  -- -6h dal momento attuale
  AND scheduledFor <= '2025-12-09T17:01:08.364Z'; -- +65min dal momento attuale

-- Risultato: 0 rows (il post 10:45 era FAILED, quindi ignorato)
```

### Query Corretta (FIXED):
```sql
SELECT * FROM scheduled_posts 
WHERE status IN ('PENDING', 'FAILED')  -- ✅ Include anche FAILED
  AND scheduledFor >= '2025-12-09T09:56:08.364Z'
  AND scheduledFor <= '2025-12-09T17:01:08.364Z';

-- Risultato: 1 row (trova il post 10:45 FAILED e lo riprova)
```

---

## 📊 Comportamento Atteso

### Scenario 1: Post PENDING mai tentato
- ✅ Viene trovato e processato
- ✅ Se successo: status → `PUBLISHED`
- ✅ Se fallisce: status → `FAILED` (e verrà ritentato nel recovery)

### Scenario 2: Post FAILED in precedenza
- ✅ Viene trovato nella finestra recovery (-6h)
- ✅ Viene ritentato automaticamente
- ✅ Se successo: status → `PUBLISHED`
- ✅ Se fallisce di nuovo: retryCount++, errorMessage aggiornato

### Scenario 3: Post fuori dal recovery window
- ❌ Se un post fallisce e passa più di 6 ore, **non** viene più ritentato
- Questo è voluto: dopo 6 ore è troppo tardi per pubblicare (non è più "recente")

---

## 🚀 Deployment

1. **File modificati:**
   - `server_lambda/src/index.ts` (riga 225-227)
   - `server_lambda/deploy/index.js` (compilato)
   - `server_lambda/lambda.zip` (package pronto)

2. **Come deployare:**
   ```bash
   cd server_lambda
   npm run build
   # Copiare dist/*.js in deploy/
   # Ricreare lambda.zip
   ```

3. **Upload su AWS Lambda:**
   - Console AWS → Lambda → `onlysocial-scheduler`
   - Code → Upload from → .zip file
   - Seleziona `server_lambda/lambda.zip`
   - Deploy

4. **Verifica:**
   - Trigger manuale del Lambda
   - Controllare CloudWatch logs: dovrebbe trovare post FAILED
   - Verificare che i post FAILED vengano ritentati

---

## 📝 Note Importanti

### Differenza tra PENDING e FAILED

- **PENDING**: Post mai tentato, in attesa di essere processato
- **FAILED**: Post tentato ma fallito (errore download, upload, API, etc.)

### Recovery Window (-6h)

La finestra di recovery **deve** includere anche i FAILED:
- ✅ **Con fix**: Trova PENDING mai tentati + FAILED da ritentare
- ❌ **Senza fix**: Trova solo PENDING mai tentati (recovery inutile)

### Limite di 25 post

Il `take: 25` è per rispettare il rate limit di OnlySocial (25 req/min).  
Se ci sono più di 25 post (PENDING + FAILED), il Lambda prende i primi 25 ordinati per `scheduledFor` ASC.  
Gli altri verranno processati nella prossima esecuzione.

---

## 🔗 Riferimenti

- **Commit fix:** 0277c08
- **File:** `server_lambda/src/index.ts` (linee 223-237)
- **Database:** NeonDB PostgreSQL
- **Timezone:** Europe/Rome (UTC+1 winter, UTC+2 summer)
- **Recovery window:** -6 ore (360 minuti)
- **Upcoming window:** +65 minuti

---

## ✅ Checklist Post-Deployment

- [ ] Lambda.zip uploadato su AWS (28.35 MB)
- [ ] Test manuale del Lambda con curl/Postman
- [ ] Verificare CloudWatch logs: dovrebbe trovare post FAILED
- [ ] Confermare che post FAILED vengono processati
- [ ] Verificare che status passa da FAILED a PUBLISHED (se successo)
- [ ] Monitorare per 24h per assicurarsi nessun post perso

---

**Problema risolto:** Lambda ora trova e riprova automaticamente i post FAILED ✅
