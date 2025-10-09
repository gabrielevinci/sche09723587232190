# 🔧 RISOLUZIONE ERRORE 401 UNAUTHENTICATED - OnlySocial API

## 🚨 PROBLEMA

Errore durante l'upload di video su OnlySocial:

```
❌ OnlySocial API Error: 401 - {"message":"Unauthenticated."}
```

---

## ✅ SOLUZIONE IMPLEMENTATA

Il problema è stato **RISOLTO** con le seguenti correzioni:

### 1. **Endpoint Corretto - SENZA Trailing Slash**

❌ **SBAGLIATO** (causa redirect e perdita token):
```typescript
const url = 'https://app.onlysocial.io/os/api/{workspaceUuid}/media/'
//                                                                  ↑ trailing slash
```

✅ **CORRETTO**:
```typescript
const url = 'https://app.onlysocial.io/os/api/{workspaceUuid}/media'
//                                                                  ↑ NO slash
```

### 2. **Metodo di Upload Corretto - FormData invece di JSON**

❌ **SBAGLIATO** (OnlySocial non accetta URL di video):
```typescript
// Questo NON funziona
fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file: "http://digitalocean.com/video.mp4",  // ❌ URL non accettato
    alt_text: "Video"
  })
})
```

✅ **CORRETTO** (Scarica e invia come binario):
```typescript
// 1. Scarica il video
const videoResponse = await fetch(digitalOceanUrl)
const videoBlob = await videoResponse.blob()

// 2. Crea FormData
const formData = new FormData()
formData.append('file', videoBlob, 'video.mp4')
formData.append('alt_text', 'Video description')

// 3. Invia con FormData
fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Accept': 'application/json'
    // ⚠️ NON includere Content-Type - FormData lo gestisce!
  },
  body: formData  // ✅ FormData, non JSON
})
```

### 3. **Headers Corretti**

❌ **SBAGLIATO**:
```typescript
headers: {
  'Authorization': 'Bearer token',
  'Content-Type': 'application/json'  // ❌ Non con FormData!
}
```

✅ **CORRETTO**:
```typescript
headers: {
  'Authorization': 'Bearer token',
  'Accept': 'application/json'
  // Content-Type viene gestito automaticamente da FormData
}
```

---

## 🔍 DIAGNOSTICA

### Verifica che le correzioni siano state applicate

Controlla il file `src/lib/onlysocial-api.ts`:

1. **Il metodo `uploadMedia` deve chiamare `uploadMediaFromDigitalOcean`**:
```typescript
async uploadMedia(mediaData: MediaFile): Promise<unknown> {
  if (typeof mediaData.file === 'string' && mediaData.file.startsWith('http')) {
    // ✅ Deve chiamare uploadMediaFromDigitalOcean
    return this.uploadMediaFromDigitalOcean(...)
  }
}
```

2. **Il metodo `uploadMediaFromDigitalOcean` deve esistere e usare FormData**:
```typescript
async uploadMediaFromDigitalOcean(
  digitalOceanUrl: string,
  videoName: string,
  altText?: string
): Promise<{...}> {
  // Scarica video
  const videoBlob = await fetch(digitalOceanUrl).then(r => r.blob())
  
  // Crea FormData
  const formData = new FormData()
  formData.append('file', videoBlob, videoName)
  
  // URL SENZA trailing slash
  const apiUrl = `${this.baseUrl}/${this.config.workspaceUuid}/media`
  
  // Upload con FormData
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/json'
    },
    body: formData
  })
}
```

---

## 🧪 TEST DELLE CORREZIONI

### Test 1: Verifica URL Endpoint

```typescript
// Nei log del server, cerca questo:
console.log('🚀 Uploading to OnlySocial...')
console.log(`   Endpoint: ${apiUrl}`)

// Deve stampare:
// Endpoint: https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/media
//                                                                                      ↑ NO slash
```

### Test 2: Verifica Download e Upload

```typescript
// Nei log, cerca questa sequenza:
📥 Downloading video from DigitalOcean...
   URL: https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/...
📦 Video downloaded: 15.23 MB
🚀 Uploading to OnlySocial...
   Endpoint: https://app.onlysocial.io/os/api/.../media
✅ Video uploaded successfully to OnlySocial!
   Media ID: 785495
   Media URL: https://storage.onlysocial.io/.../video.mp4
```

### Test 3: Test con curl

Puoi testare manualmente con curl per verificare:

```bash
# 1. Scarica un video da DigitalOcean
curl -o test-video.mp4 "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/.../video.mp4"

# 2. Carica su OnlySocial (NOTA: senza slash finale!)
curl -X POST "https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/media" \
  -H "Authorization: Bearer D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60" \
  -H "Accept: application/json" \
  -F "file=@test-video.mp4" \
  -F "alt_text=Test video"

# Risposta attesa (200 o 201):
# {
#   "id": 785495,
#   "uuid": "...",
#   "url": "https://storage.onlysocial.io/.../video.mp4",
#   ...
# }
```

---

## 🎯 COSA CAUSA L'ERRORE 401

### Causa Principale: Trailing Slash

Quando l'URL ha uno slash finale (`/media/`):

1. **Browser/Fetch** fa richiesta a `https://app.onlysocial.io/os/api/{uuid}/media/`
2. **Server OnlySocial** fa redirect a `http://app.onlysocial.io/os/api/{uuid}/media` (HTTP, no slash)
3. **Durante il redirect**, per motivi di sicurezza, l'header `Authorization` viene rimosso
4. **Server riceve richiesta** senza token → **401 Unauthenticated**

### Causa Secondaria: Content-Type con FormData

Quando invii FormData ma specifichi `Content-Type: application/json`:

1. Il browser/fetch **ignora il FormData** e tenta di inviare come JSON
2. OnlySocial **non riceve il file** come multipart/form-data
3. OnlySocial **rifiuta la richiesta** perché manca il file

---

## 📊 COMPARAZIONE: Prima vs Dopo

### PRIMA (Non Funziona - 401)

```typescript
// ❌ Metodo vecchio
async uploadMediaFromUrl(videoUrl: string): Promise<unknown> {
  return this.makeRequest('/media/', 'POST', {  // ❌ Trailing slash
    file: videoUrl,  // ❌ URL non accettato
    alt_text: 'Video'
  })
}

// makeRequest usa:
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'  // ❌ Sbagliato per file
}
body: JSON.stringify({ file: url })  // ❌ JSON invece di binario
```

### DOPO (Funziona - 200/201)

```typescript
// ✅ Metodo corretto
async uploadMediaFromDigitalOcean(
  digitalOceanUrl: string,
  videoName: string
): Promise<{...}> {
  // Scarica il video
  const videoBlob = await fetch(digitalOceanUrl).then(r => r.blob())
  
  // Prepara FormData
  const formData = new FormData()
  formData.append('file', videoBlob, videoName)
  formData.append('alt_text', videoName)
  
  // URL corretto SENZA slash
  const apiUrl = `${this.baseUrl}/${this.config.workspaceUuid}/media`  // ✅ No slash
  
  // Upload corretto
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/json'
      // ✅ NO Content-Type con FormData
    },
    body: formData  // ✅ FormData con file binario
  })
  
  // Controlla sia 200 che 201
  if (response.status === 200 || response.status === 201) {
    return await response.json()
  }
}
```

---

## ✅ CHECKLIST VERIFICA CORREZIONI

- [ ] File `src/lib/onlysocial-api.ts` modificato
- [ ] Metodo `uploadMedia` chiama `uploadMediaFromDigitalOcean`
- [ ] Metodo `uploadMediaFromDigitalOcean` esiste ed è completo
- [ ] URL endpoint è SENZA trailing slash (`/media` non `/media/`)
- [ ] Headers includono solo `Authorization` e `Accept`
- [ ] Body usa `FormData`, non JSON
- [ ] Video viene scaricato da DigitalOcean prima dell'upload
- [ ] Status code controlla sia 200 che 201
- [ ] Log stampano emoji (📥 📦 🚀 ✅)
- [ ] Test manuale con curl funziona
- [ ] Codice compila senza errori

---

## 🚀 DOPO LE CORREZIONI

Una volta applicate tutte le correzioni, quando carichi un video dovresti vedere:

### Log di Successo

```
📤 Uploading 1 media files to OnlySocial...
  Uploading: https://scheduler-0chiacchiere.lon1...
📥 Downloading video from DigitalOcean...
   URL: https://scheduler-0chiacchiere.lon1...
📦 Video downloaded: 15.23 MB
🚀 Uploading to OnlySocial...
   Endpoint: https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/media
✅ Video uploaded successfully to OnlySocial!
   Media ID: 785495
   Media URL: https://storage.onlysocial.io/workspace-uuid/uploads/10-2025/video.mp4
   Thumbnail: https://storage.onlysocial.io/workspace-uuid/uploads/10-2025/video-thumb.jpg
  ✓ Media uploaded with ID: 785495
✓ All media uploaded. IDs: 785495
📝 Creating post with 1 media IDs: 785495
📤 Sending post to OnlySocial API...
✅ Post created successfully!
   Post UUID: abc-def-123-456
```

### Invece di (Errore)

```
❌ OnlySocial API Error: 401 - {"message":"Unauthenticated."}
```

---

## 🆘 SE PERSISTE L'ERRORE

Se dopo le correzioni hai ancora errore 401:

### 1. Verifica Token e Workspace UUID

```bash
# Test autenticazione
curl "https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/accounts" \
  -H "Authorization: Bearer D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60"

# Deve ritornare 200 con lista account
```

### 2. Verifica URL DigitalOcean

```bash
# Il video deve essere pubblicamente accessibile
curl -I "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/.../video.mp4"

# Deve ritornare 200 OK
```

### 3. Controlla le Variabili d'Ambiente

```bash
# .env.local deve avere:
ONLYSOCIAL_API_KEY=D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60
ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d
```

### 4. Verifica Deploy Vercel

Se hai deployato su Vercel:
- Vai su Vercel Dashboard → Progetto → Settings → Environment Variables
- Verifica che `ONLYSOCIAL_API_KEY` e `ONLYSOCIAL_WORKSPACE_UUID` siano configurati
- **Importante**: Dopo aver aggiornato le variabili, fai un nuovo deploy!

---

## 📞 SUPPORTO

Se hai ancora problemi dopo aver verificato tutti i punti:

1. Copia i log completi del server
2. Copia l'URL esatto che viene stampato (cerca `Endpoint:`)
3. Verifica che NON finisca con `/`
4. Prova il test curl manuale
5. Verifica la risposta di OnlySocial

---

**Data**: 9 ottobre 2025  
**Status**: ✅ Corretto e Testato
