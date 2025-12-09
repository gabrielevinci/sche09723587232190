# FIX: Query Database Post Programmati

## 🔴 Problema Riscontrato

Il Lambda non trovava post programmati che dovevano rientrare nella finestra di ricerca.

**Esempio:**
- Lambda cerca tra: **04:00 - 11:05** (ora italiana)
- Post programmato per: **10:45** (ora italiana)
- Risultato: **NON TROVATO** ❌
- Log: `📊 [Lambda] Found 0 videos to process`

---

## 🔍 Causa Root

### **Database mostra:**
```sql
scheduledFor (DB raw): 2025-12-09 10:45:00  -- TIMESTAMP senza timezone
```

### **Il problema era DUPLICE:**

### 1️⃣ **Dashboard usava offset fisso `+01:00`**
```typescript
// ❌ PRIMA (SBAGLIATO)
const scheduledForISO = `${year}-${month}-${day}T${hour}:${minute}:00+01:00`
```

Questo era sbagliato perché:
- **Inverno (dicembre)**: UTC+1 ✅ Corretto
- **Estate (giugno-settembre)**: UTC+2 ❌ Sbagliato (doveva essere `+02:00`)

### 2️⃣ **API aggiungeva +1h manualmente**
```typescript
// ❌ PRIMA (SBAGLIATO)
const scheduleDateAdjusted = new Date(scheduleDate.getTime() + (60 * 60 * 1000)) // +1 ora
```

Questo causava:
- **Post delle 10:45 IT** → salvato come **10:45 UTC** nel DB
- **Lambda cerca 04:00-11:05 IT** → **08:00-10:05 UTC**
- **10:45 UTC > 10:05 UTC** → **POST NON TROVATO** ❌

---

## ✅ Soluzione Implementata

### **1. Dashboard: Calcolo offset DST-aware**

```typescript
// ✅ DOPO (CORRETTO)
// Determina l'offset corretto (UTC+1 in inverno, UTC+2 in estate)
const testDate = new Date(`${year}-${month}-${day}T12:00:00Z`)
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Rome',
  timeZoneName: 'short'
})
const parts = formatter.formatToParts(testDate)
const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'CET'
const offset = tzName.includes('CEST') ? '+02:00' : '+01:00' // CEST=estate, CET=inverno

// Crea la stringa ISO con offset corretto per Europe/Rome
const scheduledForISO = `${year}-${month}-${day}T${hour}:${minute}:00${offset}`
```

**Come funziona:**
- Crea una data di test per il giorno scelto
- Usa `Intl.DateTimeFormat` per determinare il timezone name
- **CET** (Central European Time) → **UTC+1** (inverno)
- **CEST** (Central European Summer Time) → **UTC+2** (estate)
- Crea la stringa ISO con l'offset corretto

### **2. API: Rimozione aggiustamento manuale**

```typescript
// ✅ DOPO (CORRETTO)
// Parse la data italiana con offset (es: "2025-12-13T13:00:00+01:00")
// PostgreSQL TIMESTAMP salva in UTC automaticamente
const scheduleDate = new Date(scheduledFor)

console.log(`⏰ Scheduling post in Italian timezone:`)
console.log(`   Received (IT time): ${scheduledFor}`)
console.log(`   UTC equivalent: ${scheduleDate.toISOString()}`)

// Salva nel database (PostgreSQL converte automaticamente in UTC)
const savedPost = await saveScheduledPost({
  // ...
  scheduledFor: scheduleDate, // PostgreSQL salva in UTC
  timezone: 'Europe/Rome',
})
```

**Come funziona:**
- Riceve data con offset corretto dalla dashboard (es: `2025-12-09T10:45:00+01:00`)
- `new Date()` la converte automaticamente in UTC (es: `2025-12-09T09:45:00Z`)
- PostgreSQL salva come `2025-12-09 09:45:00` (UTC)
- Lambda cerca correttamente in UTC

---

## 🔄 Flusso Corretto Finale

### **Esempio: Post programmato per 10:45 ora italiana (dicembre)**

1. **Dashboard (Client)**:
   ```
   Utente seleziona: 2025-12-09 10:45
   Offset calcolato: +01:00 (dicembre = CET)
   Invia al server: "2025-12-09T10:45:00+01:00"
   ```

2. **API (Server)**:
   ```
   Riceve: "2025-12-09T10:45:00+01:00"
   new Date() converte: 2025-12-09T09:45:00Z (UTC)
   Salva nel DB: 2025-12-09 09:45:00 (TIMESTAMP UTC)
   ```

3. **Lambda (Scheduler)**:
   ```
   Ora UTC: 2025-12-09 09:00:00
   Finestra: 08:00:00 UTC → 10:05:00 UTC
   Post DB: 09:45:00 UTC
   Risultato: ✅ TROVATO (09:45 è dentro 08:00-10:05)
   ```

---

## 📊 Esempio Numerico

### **Scenario: Lambda eseguito alle 10:00 ora italiana (09:00 UTC)**

| Descrizione | Ora Italiana | Ora UTC | Note |
|------------|--------------|---------|------|
| Lambda eseguito | 10:00 | 09:00 | Ora corrente |
| Finestra inizio (-6h) | 04:00 | 03:00 | Recovery 6 ore indietro |
| Finestra fine (+65min) | 11:05 | 10:05 | Upcoming 65 minuti avanti |
| Post programmato | 10:45 | 09:45 | Post da trovare |
| **Verifica** | ✅ | ✅ | **09:45 UTC è dentro 03:00-10:05 UTC** |

---

## 🧪 Test per Verificare il Fix

### **1. Post già salvati (VECCHIO sistema)**

I post salvati con il vecchio sistema potrebbero essere sballati. Per verificarli:

```python
# Esegui: python scripts/check-failed-posts.py

# Esempio output:
# scheduledFor (UTC):    2025-12-09 10:45:00 UTC  ← Salvato male
# scheduledFor (IT):     2025-12-09 11:45:00 CET  ← +1h sbagliato
```

**Soluzione:** Questi post devono essere **riprogrammati** con la dashboard aggiornata.

### **2. Nuovi post (NUOVO sistema)**

```python
# Post creato con dashboard aggiornata:
# Utente seleziona: 2025-12-10 14:30 (ora italiana)
# 
# Database dovrebbe mostrare:
# scheduledFor (UTC):    2025-12-10 13:30:00 UTC  ← Corretto (-1h)
# scheduledFor (IT):     2025-12-10 14:30:00 CET  ← Come l'utente voleva
```

---

## 📝 File Modificati

1. **`src/app/dashboard/page.tsx`** (righe 235-251)
   - ✅ Calcolo offset DST-aware con `Intl.DateTimeFormat`
   - ✅ Rileva automaticamente CET (+01:00) o CEST (+02:00)

2. **`src/app/api/posts/schedule/route.ts`** (righe 84-97, 120)
   - ✅ Rimossa logica `scheduleDateAdjusted` (+1h manuale)
   - ✅ PostgreSQL gestisce conversione UTC automaticamente

3. **`server_lambda/src/index.ts`** (invariato)
   - ✅ Query già corretta con finestra UTC

---

## ⚠️ IMPORTANTE: Post Vecchi

I post creati **PRIMA di questo fix** potrebbero essere salvati con orari sbagliati.

### **Opzione 1: Riprogrammarli**
- Elimina i post PENDING vecchi
- Ricreali con la dashboard aggiornata

### **Opzione 2: Fix manuale SQL** (avanzato)
```sql
-- ATTENZIONE: Eseguire solo se sai cosa fai
-- Aggiusta i post spostando -1h (se erano estate +2h)
UPDATE scheduled_posts
SET "scheduledFor" = "scheduledFor" - INTERVAL '1 hour'
WHERE status = 'PENDING'
  AND "scheduledFor" > NOW()
  AND "scheduledFor" < '2025-12-31';
```

**Consiglio:** Usa **Opzione 1** (riprogrammare) per sicurezza.

---

## 🎯 Verifica Finale

Dopo il deploy:

1. **Crea un nuovo post** per domani alle 15:00 (ora italiana)
2. **Controlla nel database**:
   ```sql
   SELECT id, "scheduledFor", status, timezone
   FROM scheduled_posts
   WHERE status = 'PENDING'
   ORDER BY "scheduledFor" DESC
   LIMIT 1;
   ```
3. **Verifica che sia salvato come 14:00 UTC** (se dicembre)
4. **Test Lambda**: Esegui manualmente e verifica che trovi il post

---

## 🚀 Deploy

### **1. Deploy Vercel (Dashboard + API)**
```bash
git add .
git commit -m "fix: calcolo offset DST-aware per Europe/Rome, rimuovi +1h manuale"
git push
```

Vercel autodeploya automaticamente.

### **2. Test Post-Deploy**

Crea un post di test tramite dashboard:
- Programma per un orario entro le prossime 7 ore
- Verifica nei log Lambda che venga trovato

---

## 📚 Riferimenti

- **PostgreSQL TIMESTAMP**: https://www.postgresql.org/docs/current/datatype-datetime.html
- **JavaScript Date**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- **Intl.DateTimeFormat**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- **Europe/Rome Timezone**: UTC+1 (CET) in inverno, UTC+2 (CEST) da ultima domenica marzo a ultima domenica ottobre
