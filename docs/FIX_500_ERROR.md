# 🔧 Fix Errore 500 OnlySocial API

## 📋 Problema

Riceviamo un errore **500 Server Error** da OnlySocial API quando tentiamo di caricare video.

```
❌ OnlySocial API Error: 500 {
    "message": "Server Error"
}
```

## ✅ Progressi Fatti

1. **Download da DigitalOcean**: ✅ Funziona correttamente
   - Video scaricati con successo (0.66 MB, 1.61 MB, 2.62 MB)
   - Blob creato correttamente

2. **Endpoint Corretto**: ✅ Senza trailing slash
   - `https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/media`

3. **Headers Corretti**: ✅ Solo Authorization e Accept
   - `Authorization: Bearer D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60`
   - `Accept: application/json`
   - NO Content-Type (gestito da FormData)

## 🔍 Possibili Cause dell'Errore 500

### 1. MIME Type del Video
Il video scaricato potrebbe non avere il MIME type corretto, causando problemi sul server.

**Soluzione Implementata**:
```typescript
// Se il blob non ha il MIME type, creane uno con il tipo corretto
if (!videoBlob.type || videoBlob.type === 'application/octet-stream') {
  fileBlob = new Blob([videoBlob], { type: 'video/mp4' })
}
```

### 2. Nome del File
Il nome del file estratto dall'URL potrebbe contenere caratteri speciali o parametri.

Esempi di nomi problematici:
```
6beautiful%23sightseeing%23scenic7530808698965380365.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&...
```

**✅ Soluzione Implementata**:
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
- Prima: `6beautiful%23sightseeing%23scenic7530808698965380365.mp4?X-Amz-Algorithm=...`
- Dopo: `6beautiful_sightseeing_scenic7530808698965380365.mp4`

### 3. Dimensione del File
OnlySocial potrebbe avere limiti sulla dimensione dei file non documentati.

File testati:
- 0.66 MB ❌
- 1.61 MB ❌
- 2.62 MB ❌

Tutti sotto i 3 MB, quindi probabilmente non è un problema di dimensione.

### 4. Formato del FormData
Il campo `alt_text` potrebbe non essere gestito correttamente.

**Soluzione Implementata**:
```typescript
formData.append('file', fileBlob, videoName)

// SOLO se altText è fornito
if (altText) {
  formData.append('alt_text', altText)
}
```

### 5. Workspace UUID o API Key
Potrebbero essere scaduti o non validi.

**Da Verificare**:
- API Key: `D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60`
- Workspace: `1d59b252-887e-4a8e-be52-6cafdf3dae2d`

## 🚀 Modifiche Implementate

### 1. MIME Type Corretto
```typescript
let fileBlob = videoBlob
if (!videoBlob.type || videoBlob.type === 'application/octet-stream') {
  console.log('   ⚠️ Blob has no MIME type, setting to video/mp4')
  fileBlob = new Blob([videoBlob], { type: 'video/mp4' })
}
```

### 2. Logging Dettagliato
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
console.log(`   Body: ${responseText}`)
```

### 3. Gestione Errori Migliorata
```typescript
try {
  const errorJson = JSON.parse(responseText)
  errorDetails = JSON.stringify(errorJson, null, 2)
  
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

## 📝 Prossimi Passi

1. **Deploy su Vercel** con le modifiche
2. **Analizza i nuovi log** per vedere:
   - MIME Type del blob
   - Headers della risposta
   - Dettagli dell'errore (se presenti)
3. **Test con file più piccolo** (< 1 MB)
4. **Verifica API Key** sul dashboard OnlySocial
5. **Contatta supporto OnlySocial** se l'errore persiste

## 🧪 Come Testare

1. Fai il push su GitHub (viene fatto automaticamente)
2. Vercel farà il deploy automatico
3. Prova a schedulare un post
4. Controlla i log su Vercel per vedere:
   ```
   📦 Video downloaded: X MB
      MIME Type: video/mp4  <-- Dovrebbe essere video/mp4
   🚀 Uploading to OnlySocial...
      File Type: video/mp4  <-- Dovrebbe essere video/mp4
   📡 Response from OnlySocial:
      Status: XXX
      Headers: {...}
      Body: {...}
   ```

## 🔗 Riferimenti

- [OnlySocial API Docs](https://app.onlysocial.io/docs)
- [CHANGELOG_401_FIX.md](../CHANGELOG_401_FIX.md)
- [FIX_401_ERROR.md](./FIX_401_ERROR.md)

## 📊 Status

- ✅ Download da DigitalOcean
- ✅ FormData con binary file
- ✅ Endpoint senza trailing slash
- ✅ Headers corretti
- ✅ MIME type corretto
- ✅ **Filename sanitizzato (rimozione query params e caratteri speciali)**
- ✅ Logging dettagliato
- ⏳ In attesa di test su Vercel per vedere se l'errore 500 è risolto
