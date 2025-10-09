# 📝 Changelog - Fix Errore 500 OnlySocial API

## Data: 9 Ottobre 2025

## 🎯 Obiettivo
Risolvere l'errore 500 Server Error durante l'upload di video a OnlySocial API.

## 🐛 Problema Identificato

### Errore Ricevuto
```
❌ OnlySocial API Error: 500 {
    "message": "Server Error"
}
```

### Causa Principale (Ipotesi)
Il nome del file estratto dall'URL di DigitalOcean conteneva:
1. **Query parameters** (tutto dopo il `?`)
2. **Caratteri URL-encoded** (`%23` per `#`, `%20` per spazio, etc.)
3. **Caratteri speciali** (`#`, ` `, etc.)

Esempio problematico:
```
6beautiful%23sightseeing%23scenic7530808698965380365.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...
```

## ✅ Modifiche Implementate

### 1. Sanitizzazione Nome File (`src/lib/onlysocial-api.ts`)

**Prima**:
```typescript
const fileName = mediaData.file.split('/').pop() || 'video.mp4'
```

**Dopo**:
```typescript
// Estrai il nome del file dall'URL e sanitizzalo
let fileName = mediaData.file.split('/').pop() || 'video.mp4'

// Rimuovi query parameters (tutto dopo ?)
fileName = fileName.split('?')[0]

// Decodifica caratteri URL-encoded (%20, %23, etc.)
fileName = decodeURIComponent(fileName)

// Sanitizza il nome del file: rimuovi caratteri speciali problematici
fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')

// Assicurati che ci sia un'estensione
if (!fileName.includes('.')) {
  fileName += '.mp4'
}

console.log(`📝 Original URL: ${mediaData.file.substring(0, 100)}...`)
console.log(`📝 Sanitized filename: ${fileName}`)
```

**Risultato**:
- Input: `6beautiful%23sightseeing%23scenic7530808698965380365.mp4?X-Amz-Algorithm=...`
- Output: `6beautiful_sightseeing_scenic7530808698965380365.mp4`

### 2. MIME Type Corretto (`src/lib/onlysocial-api.ts`)

**Aggiunto**:
```typescript
// ⚠️ IMPORTANTE: Assicurati che il blob abbia il MIME type corretto
let fileBlob = videoBlob
if (!videoBlob.type || videoBlob.type === 'application/octet-stream') {
  console.log('   ⚠️ Blob has no MIME type, setting to video/mp4')
  fileBlob = new Blob([videoBlob], { type: 'video/mp4' })
}
```

### 3. FormData Alt Text Opzionale

**Prima**:
```typescript
formData.append('alt_text', altText || videoName)
```

**Dopo**:
```typescript
// ✅ SOLO se altText è fornito, aggiungilo
if (altText) {
  formData.append('alt_text', altText)
}
```

### 4. Logging Dettagliato

**Aggiunto**:
```typescript
console.log('🚀 Uploading to OnlySocial...')
console.log(`   Endpoint: ${apiUrl}`)
console.log(`   File Name: ${videoName}`)
console.log(`   File Size: ${videoSizeMB} MB`)
console.log(`   File Type: ${fileBlob.type}`)
console.log(`   Alt Text: ${altText || '(none)'}`)

console.log('📡 Response from OnlySocial:')
console.log(`   Status: ${response.status} ${response.statusText}`)
console.log(`   Headers:`, Object.fromEntries(response.headers.entries()))
console.log(`   Body: ${responseText.substring(0, 500)}...`)
```

### 5. Gestione Errori Migliorata

**Aggiunto**:
```typescript
try {
  const errorJson = JSON.parse(responseText)
  errorDetails = JSON.stringify(errorJson, null, 2)
  
  // Se c'è un messaggio di errore specifico, loggalo
  if (errorJson.message) {
    console.error(`   Error Message: ${errorJson.message}`)
  }
  if (errorJson.errors) {
    console.error(`   Validation Errors:`, errorJson.errors)
  }
} catch {
  // Non è JSON, usa il testo grezzo
}
```

## 📁 File Modificati

1. **src/lib/onlysocial-api.ts**
   - Metodo `uploadMedia()`: Sanitizzazione nome file
   - Metodo `uploadMediaFromDigitalOcean()`: 
     - MIME type corretto
     - FormData ottimizzato
     - Logging dettagliato
     - Gestione errori migliorata

2. **docs/FIX_500_ERROR.md** (Nuovo)
   - Documentazione completa del problema
   - Analisi delle possibili cause
   - Soluzioni implementate
   - Guide per il testing

3. **docs/CHANGELOG_500_FIX.md** (Questo file)
   - Registro di tutte le modifiche

## 🧪 Testing

### Come Testare
1. **Push su GitHub** (automatico)
2. **Deploy su Vercel** (automatico)
3. **Prova a schedulare un post**
4. **Controlla i log su Vercel** per vedere:
   ```
   📝 Original URL: https://scheduler-0chiacchiere...
   📝 Sanitized filename: 6beautiful_sightseeing_scenic7530808698965380365.mp4
   📦 Video downloaded: 2.62 MB
      MIME Type: video/mp4
   🚀 Uploading to OnlySocial...
      File Name: 6beautiful_sightseeing_scenic7530808698965380365.mp4
      File Type: video/mp4
   📡 Response from OnlySocial:
      Status: 200 OK  <-- DOVREBBE ESSERE 200 O 201
   ```

### Scenari di Test
1. ✅ Video con caratteri speciali nel nome
2. ✅ Video con URL parameters
3. ✅ Video senza MIME type
4. ✅ Video di varie dimensioni (0.66 MB - 2.62 MB)

## 📈 Risultati Attesi

### Prima della Fix
```
❌ OnlySocial API Error: 500 {
    "message": "Server Error"
}
```

### Dopo la Fix
```
✅ Video uploaded successfully to OnlySocial!
   Media ID: 12345
   Media URL: https://app.onlysocial.io/...
```

## 🔄 Rollback Plan

Se la fix non funziona, puoi fare rollback con:
```bash
git revert HEAD
git push
```

## 📚 Documentazione Correlata

- [FIX_500_ERROR.md](./FIX_500_ERROR.md) - Guida completa all'errore 500
- [FIX_401_ERROR.md](./FIX_401_ERROR.md) - Guida all'errore 401 (risolto)
- [CHANGELOG_401_FIX.md](../CHANGELOG_401_FIX.md) - Changelog fix 401

## 🎓 Lezioni Apprese

1. **Sanitizzare sempre i nomi dei file** provenienti da URL
2. **Rimuovere query parameters** prima di usare i nomi file
3. **Decodificare caratteri URL-encoded** per evitare problemi
4. **Verificare il MIME type** dei blob prima di inviarli
5. **Logging dettagliato** è essenziale per il debug di API esterne

## 🚀 Next Steps

1. ⏳ Deploy e test su Vercel
2. ⏳ Verifica che l'errore 500 sia risolto
3. ⏳ Se persiste, analizza i nuovi log dettagliati
4. ⏳ Eventualmente contatta supporto OnlySocial con i log

## 📞 Supporto

Se l'errore persiste dopo queste modifiche:
1. Controlla i log dettagliati su Vercel
2. Verifica che l'API key sia valida su OnlySocial dashboard
3. Contatta il supporto OnlySocial con:
   - Workspace UUID
   - Log completi della richiesta
   - Filename sanitizzato
   - Dimensione del file
   - MIME type del file

---

**Status**: ⏳ In attesa di test su Vercel
**Autore**: GitHub Copilot
**Data**: 9 Ottobre 2025
