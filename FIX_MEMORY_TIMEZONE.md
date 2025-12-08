# 🚨 Fix Urgenti Lambda - Out of Memory + Timezone

## 🔴 Problema 1: Out of Memory (512 MB)

### Log Errore
```
Duration: 22881.41 ms
Memory Size: 512 MB
Max Memory Used: 512 MB ❌
Status: error
Error Type: Runtime.OutOfMemory
```

### Causa
Il Lambda scarica video di grandi dimensioni (76.43 MB osservato) in memoria, poi lo carica su OnlySocial.

**Breakdown memoria:**
- Video buffer: ~76 MB
- Node.js runtime: ~80 MB
- Prisma Client: ~50 MB
- Librerie: ~100 MB
- **Overhead:** ~150-200 MB
- **Totale:** ~500-550 MB → **supera i 512 MB!**

### ✅ Soluzione: Aumenta Memoria Lambda

**AWS Console:**
1. Lambda → `onlysocial-scheduler`
2. Configuration → General configuration → Edit
3. **Memory:** `512 MB` → **`1024 MB (1 GB)`** ✅
4. Save

**Costo:**
- 512 MB: $0.0000008333 per 100ms
- 1024 MB: $0.0000016667 per 100ms
- **Differenza:** ~$0.02/mese per 100 esecuzioni → **trascurabile**

**Benefici:**
- ✅ Gestisce video fino a ~400 MB
- ✅ Più veloce (più memoria = più CPU)
- ✅ Nessun timeout Out of Memory

---

## 🔴 Problema 2: Timezone Sbagliato (+2h invece di +1h)

### Log Errore
```
Trigger: 17:06 italiane (16:06 UTC)
Log Lambda:
  UTC now: 2025-12-08T16:06:33.659Z ✅ CORRETTO
  Italian now: 2025-12-08 18:06:33 ❌ SBAGLIATO (dovrebbe essere 17:06)
  
Finestra sbagliata:
  Recovery (-6h): 2025-12-08 11:06 to 2025-12-08 18:06  ❌
  Upcoming (+65min): 2025-12-08 18:06 to 2025-12-08 18:11  ❌
```

### Causa
**Codice sbagliato:**
```typescript
// ❌ SBAGLIATO: offset fisso +1h non gestisce ora legale/solare
const italianOffset = 60 * 60 * 1000; // +1 ora
const nowItalian = new Date(nowUTC.getTime() + italianOffset);
console.log(formatInTimeZone(nowItalian, TIMEZONE, 'HH:mm')); // 18:06 ❌
```

**Problema:** L'Italia ha 2 fusi orari:
- **Inverno (ora solare):** UTC+1 (novembre-marzo)
- **Estate (ora legale):** UTC+2 (marzo-novembre)

Dicembre 2025 = **UTC+1**, ma il codice aggiungeva manualmente +1h **prima** di chiamare `formatInTimeZone`, che **poi aggiungeva di nuovo +1h** → **totale +2h** ❌

### ✅ Soluzione: Usa formatInTimeZone Nativo

**Codice corretto:**
```typescript
// ✅ CORRETTO: formatInTimeZone gestisce automaticamente ora legale/solare
const nowUTC = new Date();
console.log(formatInTimeZone(nowUTC, 'Europe/Rome', 'HH:mm')); // 17:06 ✅
```

`formatInTimeZone` dalla libreria `date-fns-tz` **gestisce automaticamente**:
- ✅ Ora solare (UTC+1)
- ✅ Ora legale (UTC+2)
- ✅ Transizioni DST (Daylight Saving Time)

**Non serve fare calcoli manuali!**

---

## 📊 Log Corretti Attesi

### Trigger: 17:06 italiane (16:06 UTC)

**Output corretto:**
```
🔍 [Lambda] Time window:
   UTC now: 2025-12-08T16:06:33.659Z
   Italian now: 2025-12-08 17:06:33               ✅ CORRETTO
   Recovery (-6h): 11:06 to 17:06 (ora italiana)  ✅ CORRETTO
   Upcoming (+65min): 17:06 to 18:11 (ora italiana) ✅ CORRETTO
```

**Finestra query (UTC):**
- `sixHoursAgo`: 2025-12-08T10:06:33Z (UTC)
- `sixtyFiveMinutesFromNow`: 2025-12-08T17:11:33Z (UTC)

**Finestra query (ora italiana):**
- Recovery: 11:06 → 17:06 (6 ore)
- Upcoming: 17:06 → 18:11 (65 min)

---

## 🚀 Deploy Urgente Richiesto

### 1️⃣ Aumenta Memoria Lambda (CRITICO)
```
AWS Console → Lambda → onlysocial-scheduler
Configuration → General configuration → Edit
Memory: 512 MB → 1024 MB (1 GB)
Save
```

### 2️⃣ Carica lambda.zip Aggiornato
```
File: d:\Desktop\ONLYSOCIAL\server_lambda\lambda.zip
Size: 28.35 MB
Date: 08/12/2025 17:13:21
```

**Procedura:**
1. AWS Console → Lambda → `onlysocial-scheduler`
2. Tab "Code" → "Upload from" → ".zip file"
3. Seleziona `lambda.zip`
4. Save

### 3️⃣ Test Post-Deploy
```bash
# Test manuale
curl https://sxibldy7k8.execute-api.eu-central-1.amazonaws.com/prod/schedule \
  -X POST \
  -H "Authorization: Bearer 9a8690b9c9b6d176192e8c4d0367406d0d365fa73e546c588f1c21fff8a74397" \
  -d '{"action":"schedule"}'
```

**Log attesi:**
```
✅ Italian now: 2025-12-08 17:XX:XX (ora corrente italiana)
✅ Memory Used: ~200-400 MB (non 512 MB)
✅ Status: success (non Runtime.OutOfMemory)
```

---

## 📋 Checklist Verifica

- [ ] **Memoria Lambda aumentata a 1024 MB**
- [ ] **lambda.zip caricato (28.35 MB, 17:13:21)**
- [ ] **Test eseguito con successo**
- [ ] **Log mostra ora italiana corretta (UTC+1 in dicembre)**
- [ ] **Nessun errore Out of Memory**
- [ ] **Video caricato correttamente su OnlySocial**

---

## 🎯 Risultati Attesi

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Memoria** | 512 MB (Out of Memory) | 1024 MB (buffer 400+ MB) |
| **Timezone log** | 18:06 (UTC+2 sbagliato) | 17:06 (UTC+1 corretto) |
| **Finestra recovery** | 11:06-18:06 (sbagliata) | 11:06-17:06 (corretta) |
| **Finestra upcoming** | 18:06-18:11 (sbagliata) | 17:06-18:11 (corretta) |
| **Video 76 MB** | ❌ Crash | ✅ Caricato |
| **Durata** | 22s (poi crash) | ~15-25s (completo) |

---

## Commit

```bash
git commit 765d57e
Message: "fix: timezone corretto - usa formatInTimeZone nativo (gestisce automaticamente ora legale/solare)"
Details: Rimosso offset manuale che causava +2h invece di +1h in inverno
Date: 08/12/2025 17:13
```
