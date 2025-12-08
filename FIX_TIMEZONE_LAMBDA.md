# 🕐 Fix Calcolo Timezone Lambda

## Problema Originale

Il Lambda calcolava male la finestra temporale per cercare i video da schedulare.

### Log originale (16:00 italiane = 15:00 UTC):
```
Recovery (now-60'): 2025-12-08 16:00 to 2025-12-08 17:00  ❌ SBAGLIATO
Upcoming (now+60'): 2025-12-08 17:00 to 2025-12-08 18:00  ❌ SBAGLIATO
```

**Problema:** Il sistema cercava video dalle **16:00 alle 18:00** invece di **15:00 alle 17:00**!

### Causa Root
```typescript
// CODICE SBAGLIATO
const nowUTC = new Date(); // 15:00 UTC
const italianOffset = 60 * 60 * 1000; // +1 ora
const now = new Date(nowUTC.getTime() + italianOffset); // 16:00 ❌ 

const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));     // 15:00 ❌
const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000)); // 17:00 ❌
```

Il problema era che il codice:
1. ✅ Prendeva l'ora UTC (15:00)
2. ❌ Aggiungeva +1 ora per "convertire" in italiano (16:00)
3. ❌ Usava questa data "italiana" (16:00) per calcolare -60' e +60'
4. ❌ Risultato: finestra 15:00-17:00 invece di 14:00-16:00

**MA:** Il database PostgreSQL salva già le date in **timestamp con timezone**, quindi non serve convertire!

---

## Soluzione Implementata

```typescript
// CODICE CORRETTO
const nowUTC = new Date(); // 15:00 UTC (ora corrente Lambda)

// Finestra temporale in UTC (il DB confronta automaticamente)
const oneHourAgo = new Date(nowUTC.getTime() - (60 * 60 * 1000));     // 14:00 UTC ✅
const oneHourFromNow = new Date(nowUTC.getTime() + (60 * 60 * 1000)); // 16:00 UTC ✅

// Per i log, convertiamo in ora italiana SOLO per leggibilità
const italianOffset = 60 * 60 * 1000;
const nowItalian = new Date(nowUTC.getTime() + italianOffset); // 16:00 (solo per log)
```

### Log corretto (16:00 italiane = 15:00 UTC):
```
UTC now: 2025-12-08T15:00:00.000Z
Italian now: 2025-12-08 16:00:00
Recovery (now-60'): 2025-12-08 15:00 to 2025-12-08 16:00  ✅ CORRETTO
Upcoming (now+60'): 2025-12-08 16:00 to 2025-12-08 17:00  ✅ CORRETTO
```

---

## Query Database

```typescript
const videosToSchedule = await prisma.scheduledPost.findMany({
  where: {
    status: 'PENDING',
    scheduledFor: {
      gte: oneHourAgo,     // 14:00 UTC ✅
      lte: oneHourFromNow  // 16:00 UTC ✅
    }
  }
});
```

PostgreSQL confronta automaticamente le date:
- `scheduledFor` nel DB è salvato come `TIMESTAMP WITH TIME ZONE`
- Prisma/PostgreSQL converte automaticamente UTC ↔ Timezone database
- Non serve fare conversioni manuali!

---

## Comportamento Corretto

### Scenario: Cron job alle 16:00 (ora italiana)

**Prima (sbagliato):**
- Lambda riceve trigger alle 16:00 italiane (15:00 UTC)
- Cerca video dalle **16:00 alle 18:00** italiane
- ❌ Salta i video schedulati alle 15:00-16:00

**Dopo (corretto):**
- Lambda riceve trigger alle 16:00 italiane (15:00 UTC)
- Cerca video dalle **15:00 alle 17:00** italiane
- ✅ Trova video schedulati per 15:00-17:00
- ✅ Recupera video mancati 14:00-15:00

---

## Test di Verifica

### 1. Crea post di test
```sql
-- Post schedulato per le 16:30 italiane (oggi)
INSERT INTO scheduled_posts (
  userId, socialAccountId, scheduledFor, status, ...
) VALUES (
  'user-id', 'account-id', 
  '2025-12-08 16:30:00+01:00',  -- 16:30 ora italiana
  'PENDING', ...
);
```

### 2. Trigger cron alle 16:00 italiane
Il Lambda dovrebbe:
- ✅ Trovare il post (16:30 è dentro 15:00-17:00 UTC)
- ✅ Processarlo correttamente

### 3. Verifica log
```
UTC now: 2025-12-08T15:00:00.000Z
Italian now: 2025-12-08 16:00:00
Recovery (now-60'): 2025-12-08 15:00 to 2025-12-08 16:00
Upcoming (now+60'): 2025-12-08 16:00 to 2025-12-08 17:00
📊 [Lambda] Found 1 videos to process  ✅
```

---

## File Modificati

- `server_lambda/src/index.ts` (linee 194-205)
- `server_lambda/deploy/index.js` (compilato)
- `server_lambda/lambda.zip` (ricreato)

---

## Deploy

1. ✅ Codice committato: `fab84bc`
2. ⏳ **Devi caricare `lambda.zip` su AWS Lambda:**
   ```
   File: d:\Desktop\ONLYSOCIAL\server_lambda\lambda.zip
   Size: 28.35 MB
   Date: 08/12/2025 16:52:13
   ```

3. **Procedura AWS:**
   - AWS Console → Lambda → `onlysocial-scheduler`
   - Tab "Code" → "Upload from" → ".zip file"
   - Seleziona `lambda.zip`
   - Clicca "Save"

---

## Commit

```bash
git commit fab84bc
Message: "fix: correggi calcolo finestra temporale Lambda (rimuovi doppio offset italiano)"
Date: 08/12/2025 16:52
```
