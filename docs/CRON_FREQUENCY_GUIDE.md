# Configurazione Cron Jobs Ottimale

## Problema Risolto

✅ **Finestra di pubblicazione estesa da -30 minuti a -2 ore**
- I post MEDIA_UPLOADED vengono ora trovati anche se "in ritardo"
- I 3 post a 03:10 ora possono essere pubblicati alle 03:58

## Frequenza Cron Jobs

### Opzione 1: BILANCIATA (CONSIGLIATO) ⭐

**Pre-Upload / All-in-One:**
```bash
# Ogni 5 minuti
*/5 * * * * curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://tuodominio.com/api/cron/process-pending-videos
```

**Vantaggi:**
- ✅ Carica video 1 ora prima (finestra sufficiente)
- ✅ Pubblica entro 5 minuti dall'ora programmata
- ✅ Costi contenuti (12 chiamate/ora invece di 60)
- ✅ Nessun rate limiting
- ✅ Recupera post in ritardo fino a 2 ore

**Svantaggi:**
- ⚠️ Pubblicazione con max 5 minuti di ritardo

---

### Opzione 2: AGGRESSIVA (Max Precisione)

**Pre-Upload / All-in-One:**
```bash
# Ogni 1 minuto
* * * * * curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://tuodominio.com/api/cron/process-pending-videos
```

**Vantaggi:**
- ✅ Pubblicazione con max 1 minuto di ritardo
- ✅ Massima precisione temporale
- ✅ Test e debug più rapidi

**Svantaggi:**
- ⚠️ 60 chiamate/ora al server
- ⚠️ Possibile rate limiting da OnlySocial
- ⚠️ Costi Vercel più alti (più execution time)
- ⚠️ Più query al database

---

### Opzione 3: CONSERVATIVA (Risparmio Risorse)

**Pre-Upload / All-in-One:**
```bash
# Ogni 10 minuti
*/10 * * * * curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://tuodominio.com/api/cron/process-pending-videos
```

**Vantaggi:**
- ✅ Costi minimi (6 chiamate/ora)
- ✅ Nessun rischio rate limiting
- ✅ Sufficiente per la maggior parte dei casi

**Svantaggi:**
- ⚠️ Pubblicazione con max 10 minuti di ritardo
- ⚠️ Test più lenti

---

## Confronto Costi

| Frequenza | Chiamate/Ora | Chiamate/Giorno | Note |
|-----------|--------------|-----------------|------|
| 1 minuto | 60 | 1,440 | 💰 Alto costo |
| 5 minuti | 12 | 288 | ⭐ Bilanciato |
| 10 minuti | 6 | 144 | 💵 Risparmio |

### Costi Vercel (esempio)

Vercel Hobby Plan (Gratuito):
- 100 GB-ore/mese
- ~0.05 GB-ora per esecuzione = ~2000 esecuzioni gratis

**Frequenza 1 minuto**: 43,200 esecuzioni/mese → 💰 A pagamento
**Frequenza 5 minuti**: 8,640 esecuzioni/mese → ⭐ Vicino al limite
**Frequenza 10 minuti**: 4,320 esecuzioni/mese → 💵 Molto sotto il limite

---

## Finestra di Pubblicazione Estesa

### Prima (NON FUNZIONAVA)
```typescript
scheduledFor: {
  lte: now + 5 minuti,
  gte: now - 30 minuti  // ❌ Solo 30 minuti nel passato
}
```

Post schedulati a 03:10, cron alle 03:47 = **NON trovati**

### Dopo (FUNZIONA)
```typescript
scheduledFor: {
  lte: now + 5 minuti,
  gte: now - 120 minuti  // ✅ 2 ore nel passato
}
```

Post schedulati a 03:10, cron alle 03:47 = **Trovati e pubblicati!**

---

## Raccomandazione Finale

### Per Produzione (CONSIGLIATO)

**Usa endpoint all-in-one con frequenza 5 minuti:**

```bash
# cron-job.org o Vercel Cron
*/5 * * * * curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://tuodominio.com/api/cron/process-pending-videos
```

**Perché:**
- ✅ Bilanciamento perfetto precisione/costi
- ✅ Nessun rate limiting
- ✅ Finestra 2 ore recupera tutti i post "saltati"
- ✅ 288 chiamate/giorno = costo contenuto
- ✅ Max ritardo 5 minuti è accettabile per social media

### Per Test/Development

**Usa frequenza 1 minuto per test rapidi:**

```bash
# Solo durante test
* * * * * curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/process-pending-videos
```

---

## Configurazione su Vercel

### vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/process-pending-videos",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Variabili d'Ambiente

Assicurati di configurare su Vercel:
- `CRON_SECRET`: Il token di autenticazione
- `ONLYSOCIAL_API_KEY`: Token OnlySocial
- `ONLYSOCIAL_WORKSPACE_UUID`: UUID workspace
- `DATABASE_URL`: Connection string Neon
- Altri...

---

## Monitoraggio

### Log da Controllare

**Ogni esecuzione mostra:**
```
🔄 Cron job started: Processing pending videos
📊 Found 3 videos to process
...
✅ Cron job completed
   - Processed: 3
   - Failed: 0
```

### Alert da Configurare

1. **Troppi fallimenti**: Se `failed > 0` per 3+ esecuzioni consecutive
2. **Nessun post processato**: Se sempre `Found 0 videos` ma ci sono post PENDING
3. **Rate limiting**: Se errori 429 da OnlySocial
4. **Timeout**: Se esecuzioni > 10 secondi

---

## File Modificati

1. ✅ `/src/app/api/cron/process-pending-videos/route.ts`
   - Finestra pubblicazione: -30min → -120min

2. ✅ `/src/lib/db/neon.ts`
   - `getPostsDueForPublishing()`: -30min → -120min

3. ✅ `/scripts/debug-publish.ts`
   - Aggiornato per mostrare finestra -2h

---

## Test Immediato

Ora che la finestra è estesa, testa subito:

```bash
$env:CRON_SECRET="b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2"

curl.exe -X POST `
  -H "Authorization: Bearer $env:CRON_SECRET" `
  http://localhost:3000/api/cron/process-pending-videos
```

**Risultato atteso:**
```
📊 Found 3 videos to process
🚀 Processing post cmhcu9t8k0001l104us06ry5o
   → Publishing post now...
   ✅ Post published!
✅ Cron job completed
   - Processed: 3
   - Failed: 0
```

Poi verifica:
```bash
.\scripts\run-with-env.ps1 scripts\check-pending-posts.ts
```

**Risultato atteso:**
```
📋 Found 0 PENDING posts
📤 Found 0 MEDIA_UPLOADED posts
📊 Found 3 PUBLISHED posts  # ✅ Success!
```

---

## Conclusione

✅ **Finestra pubblicazione estesa**: Post "in ritardo" vengono recuperati
✅ **Frequenza consigliata**: 5 minuti (bilanciata)
✅ **Alternative**: 1 minuto (test) o 10 minuti (risparmio)
✅ **Costi ottimizzati**: 288 chiamate/giorno vs 1440

**Prossimo passo**: Testa manualmente per vedere i 3 post venire pubblicati! 🚀
