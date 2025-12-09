# 🐛 BUG: Offset Timezone Doppio nel Salvataggio Post

**Data scoperta**: 09 dicembre 2025  
**Severity**: 🔴 CRITICO - I post non venivano trovati dal Lambda

---

## 📋 Sintesi del Problema

Il sistema aggiungeva **+1 ora manualmente** alle date prima di salvarle nel database, pensando di "compensare" la conversione UTC di PostgreSQL. Ma questo causava un **offset doppio** perché PostgreSQL TIMESTAMP WITH TIME ZONE gestisce già automaticamente le conversioni.

---

## 🔍 Sintomi Osservati

1. **Post programmato per le 10:45 (ora italiana)** risultava salvato come:
   - UTC: `2025-12-09T10:45:00.000Z`
   - Ora italiana: `11:45` ❌ (un'ora in più!)

2. **Lambda non trovava i post**:
   - Lambda cercava: `03:00 UTC → 10:05 UTC` (04:00 → 11:05 ora italiana)
   - Post era a: `10:45 UTC` (11:45 ora italiana)
   - Post **fuori dalla finestra** di 40 minuti!

3. **Log Lambda**:
   ```
   Recovery (-6h): 04:00 to 10:00 (ora italiana)
   Upcoming (+65min): 10:00 to 11:05 (ora italiana)
   Found 0 videos to process
   ```
   Ma esisteva un post programmato per le 10:45!

---

## 🔬 Causa del Bug

### File: `src/app/api/posts/schedule/route.ts`

**Codice SBAGLIATO** (linee 94-99):

```typescript
// ❌ SBAGLIATO - Offset manuale
const scheduleDateAdjusted = new Date(scheduleDate.getTime() + (60 * 60 * 1000)) // +1 ora

// Salva nel database con la data aggiustata
const savedPost = await saveScheduledPost({
  // ...
  scheduledFor: scheduleDateAdjusted, // ❌ Data con +1h aggiunto manualmente
  // ...
})
```

### Perché era sbagliato?

1. **Frontend** invia: `2025-12-09T10:45:00+01:00` (10:45 ora italiana con offset)
2. **JavaScript** converte automaticamente in UTC: `2025-12-09T09:45:00Z` ✅
3. **Codice aggiunge +1h**: `2025-12-09T10:45:00Z` ❌
4. **PostgreSQL salva**: `2025-12-09T10:45:00Z` ❌ (un'ora in più!)
5. **Lettura come ora italiana**: `11:45` ❌ (doveva essere 10:45)

### Il commento nel codice era fuorviante:

```typescript
// IMPORTANTE: PostgreSQL converte in UTC quando salva, ma noi vogliamo mantenere l'orario italiano
// Quindi quando riceviamo "13:00+01:00", PostgreSQL lo converte in "12:00Z"
// Per compensare, aggiungiamo 1 ora alla data PRIMA di salvare
// Così PostgreSQL salverà "13:00Z" che è l'orario che vogliamo vedere
```

**Questo ragionamento è ERRATO!**

PostgreSQL TIMESTAMP WITH TIME ZONE:
- Salva SEMPRE in UTC internamente
- Quando converti in timezone specifico (es: `AT TIME ZONE 'Europe/Rome'`), riapplica l'offset
- NON serve compensare manualmente!

---

## ✅ Soluzione Implementata

### 1. Rimosso l'offset manuale

**Codice CORRETTO**:

```typescript
// ✅ CORRETTO - PostgreSQL gestisce automaticamente
const scheduleDate = new Date(scheduledFor)

console.log(`⏰ Scheduling post:`)
console.log(`   Received: ${scheduledFor}`)
console.log(`   Will be saved in DB as UTC: ${scheduleDate.toISOString()}`)

// Salva nel database - PostgreSQL converte automaticamente in UTC
const savedPost = await saveScheduledPost({
  // ...
  scheduledFor: scheduleDate, // ✅ NO adjustment - PostgreSQL gestisce la conversione
  // ...
})
```

### 2. Flusso corretto ora:

1. **Frontend** invia: `2025-12-09T10:45:00+01:00` (10:45 Italia)
2. **JavaScript** converte in UTC: `2025-12-09T09:45:00Z` ✅
3. **PostgreSQL salva**: `2025-12-09T09:45:00Z` ✅
4. **Lettura come Italia**: `10:45` ✅

### 3. Query Lambda funziona:

```
Now UTC: 2025-12-09T09:00:00.000Z (10:00 Italia)
Finestra: 03:00 UTC → 10:05 UTC (04:00 → 11:05 Italia)
Post a 09:45 UTC (10:45 Italia) → ✅ TROVATO!
```

---

## 🔧 Script di Correzione Dati

### Script 1: `scripts/fix-timezone-offset.ts`

Corregge tutti i post **PENDING** sottraendo 1 ora:

```bash
npx tsx scripts/fix-timezone-offset.ts
```

**Risultato**: 42 post corretti

### Script 2: `scripts/fix-failed-post-oggi.ts`

Corregge il post **FAILED** delle 10:45 (che era diventato 11:45):

```bash
npx tsx scripts/fix-failed-post-oggi.ts
```

**Risultato**: 1 post corretto e rimesso in PENDING

---

## 📊 Verifica Post-Fix

### Prima del fix:

```
Post programmato per: 10:45 (ora italiana)
Salvato in DB come:   10:45 UTC = 11:45 Italia ❌
Lambda cerca fino a:  10:05 UTC = 11:05 Italia
Risultato:            Post NON trovato (fuori finestra)
```

### Dopo il fix:

```
Post programmato per: 10:45 (ora italiana)
Salvato in DB come:   09:45 UTC = 10:45 Italia ✅
Lambda cerca fino a:  10:05 UTC = 11:05 Italia
Risultato:            Post TROVATO (dentro finestra)
```

---

## ⚠️ Lezioni Apprese

1. **MAI aggiungere offset manuali** quando si lavora con TIMESTAMP WITH TIME ZONE
2. PostgreSQL gestisce automaticamente tutte le conversioni timezone
3. JavaScript `Date` con ISO 8601 string (`2025-12-09T10:45:00+01:00`) converte già in UTC
4. `formatInTimeZone()` di `date-fns-tz` riapplica l'offset corretto quando leggi
5. La chiave è: **salvare in UTC, convertire solo in lettura**

---

## 🚀 Deploy

### File modificati:

1. ✅ `src/app/api/posts/schedule/route.ts` - Rimosso offset manuale
2. ✅ Database corretto con script:
   - `scripts/fix-timezone-offset.ts` (42 post PENDING)
   - `scripts/fix-failed-post-oggi.ts` (1 post FAILED → PENDING)

### Deploy su Vercel:

```bash
git add src/app/api/posts/schedule/route.ts
git add scripts/fix-timezone-offset.ts scripts/fix-failed-post-oggi.ts
git commit -m "fix: rimosso offset timezone manuale - PostgreSQL gestisce UTC automaticamente"
git push
```

**IMPORTANTE**: Lambda NON richiede modifiche (era già corretto!)

---

## ✅ Checklist Post-Deploy

- [x] Codice Vercel corretto (no +1h manuale)
- [x] Database corretto (42 post PENDING + 1 FAILED)
- [x] Lambda invariato (query già corretta)
- [ ] Deploy su Vercel completato
- [ ] Test: programmare nuovo post per domani
- [ ] Verificare che venga salvato con orario UTC corretto
- [ ] Verificare che Lambda lo trovi nella finestra oraria

---

## 📝 Test di Verifica

```typescript
// Frontend invia:
scheduledFor: "2025-12-10T15:30:00+01:00"

// Database deve contenere:
UTC: 2025-12-10T14:30:00.000Z

// Quando leggi con formatInTimeZone:
formatInTimeZone(scheduledFor, 'Europe/Rome', 'HH:mm')
// Output atteso: "15:30" ✅
```

Se l'output è `16:30`, il bug è ancora presente! ❌

---

**Fix completato**: 09 dicembre 2025, ore 10:30 (ora italiana)
